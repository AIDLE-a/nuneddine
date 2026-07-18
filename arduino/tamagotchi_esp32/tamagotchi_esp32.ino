/*
 * NuneDDine 다마고치 — ESP32-C3 Super Mini + ST7735 + BLE
 * Portrait 128×160 / DD 눈(흰자가 D자 모양) / 1.5등신
 *
 * 핀: SCLK=4, MOSI=6, CS=7, DC=3, RST=10, BTN=2, BUZZER=5
 */
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>

#define TFT_SCLK 4
#define TFT_MOSI 6
#define TFT_CS   7
#define TFT_DC   3
#define TFT_RST  10
#define BTN      2
#define BTN_MUTE 8
#define BUZZER   5

#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define MAX_STOCKS   8

Adafruit_ST7735 tft(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);

#define C_BG    0x0841
#define C_BODY  0x5DBB
#define C_LITE  0x7EDF
#define C_BAR   0x10A2
#define C_EDGE  0x3D63
#define C_DIM   0x7BEF
#define C_BLUSH 0xFBAD

// 머리 중심 (HX=64, HY=59, HR=30) → 캐릭터 y=29~105 = 가용영역 y=15~117 정중앙
#define HX 64
#define HY 59
#define HR 30
#define BY (HY+HR-5)   // 몸통 시작 y=84

// 눈: 왼쪽 D, 오른쪽 D — 24×24, 사이 간격 4px
#define EW 24
#define EH 24
#define LX (HX-EW-2)   // 38
#define RX (HX+2)       // 66  → 두 눈 간격 4px
#define EY (HY-20)      // 39  → 눈코입 그룹 중심 = HY=59 정중앙

// BLE 데이터 형식: "Name,pct,price,unit|..."  (unit = W 또는 $)
struct Stock { char name[10]; float pct; float price; char unit[2]; };
Stock stocks[MAX_STOCKS];
int   stockCount=0, stockIdx=0;
bool  bleConnected=false, dataReceived=false, silentMode=false;

byte stateOf(int i){
  if(!stockCount)return 1;
  float p=stocks[i].pct;
  if(p>2.0f)return 0; if(p>=-0.5f)return 1; if(p>=-3.0f)return 2; if(p>=-6.0f)return 4; return 3;
}
void beep(int f,int ms){if(silentMode)return;tone(BUZZER,f,ms);delay(ms+20);}
void beepHappy(){beep(880,80);beep(1046,80);beep(1318,120);}
void beepSad()  {beep(440,180);beep(330,250);}

// ══════════════════════════════════════════════════════════════════════
class ServerCallbacks:public BLEServerCallbacks{
  void onConnect(BLEServer*)override{bleConnected=true;BLEDevice::startAdvertising();}
  void onDisconnect(BLEServer*)override{bleConnected=false;BLEDevice::startAdvertising();}
};
class CharCallbacks:public BLECharacteristicCallbacks{
  void onWrite(BLECharacteristic*c)override{
    String val=c->getValue(); if(!val.length())return;
    stockCount=0; char buf[512]; strncpy(buf,val.c_str(),511);
    char*e=strtok(buf,"|");
    while(e&&stockCount<MAX_STOCKS){
      char nm[10]="",cu[2]="$"; float pct=0,price=0;
      sscanf(e,"%9[^,],%f,%f,%1s",nm,&pct,&price,cu);
      strncpy(stocks[stockCount].name,nm,9);
      stocks[stockCount].pct=pct; stocks[stockCount].price=price;
      strncpy(stocks[stockCount].unit,cu,1);
      stockCount++; e=strtok(nullptr,"|");
    }
    stockIdx=0; dataReceived=true;
  }
};

// ── 가격 콤마 포맷 ────────────────────────────────────────────────────
void formatPrice(char* buf, int bsz, const char* unit, float price){
  if(price >= 1000){
    long p = (long)(price + 0.5f);
    char tmp[16]; snprintf(tmp,16,"%ld",p);
    int len=strlen(tmp);
    char out[20]; int oi=0;
    for(int i=0;i<len;i++){
      if(i>0 && (len-i)%3==0) out[oi++]=',';
      out[oi++]=tmp[i];
    }
    out[oi]=0;
    snprintf(buf,bsz,"%s%s",unit,out);
  } else {
    snprintf(buf,bsz,"%s%.2f",unit,price);
  }
}

// ── 이펙트 헬퍼 ──────────────────────────────────────────────────────
void drawStar(int cx,int cy,int r,uint16_t c){
  tft.fillRect(cx-1,cy-r,2,r*2,c); tft.fillRect(cx-r,cy-1,r*2,2,c);
  tft.drawPixel(cx-r+1,cy-r+1,c); tft.drawPixel(cx+r-1,cy-r+1,c);
  tft.drawPixel(cx-r+1,cy+r-1,c); tft.drawPixel(cx+r-1,cy+r-1,c);
}
void drawHeart(int cx,int cy,uint16_t c){
  // 왼 볼록 — 위 모서리 깎은 픽셀 범프
  tft.fillRect(cx-3, cy-2, 2,1, c);  // 꼭대기 2px
  tft.fillRect(cx-4, cy-1, 4,3, c);  // 볼록 몸통 (cy-1 ~ cy+1)
  // 오른 볼록 — 대칭
  tft.fillRect(cx+2, cy-2, 2,1, c);  // 꼭대기 2px
  tft.fillRect(cx+1, cy-1, 4,3, c);  // 볼록 몸통 (cy-1 ~ cy+1)
  // 하트 몸통 (어깨 ~ 꼭짓점)
  tft.fillRect(cx-5, cy+2,11,3, c);
  tft.fillRect(cx-4, cy+5, 9,2, c);
  tft.fillRect(cx-3, cy+7, 7,1, c);
  tft.fillRect(cx-2, cy+8, 5,1, c);
  tft.fillRect(cx-1, cy+9, 3,1, c);
  tft.fillRect(cx,   cy+10,1,1, c);
}
void drawSweat(int x,int y,uint16_t c){
  tft.fillRect(x,y,3,6,c); tft.fillRect(x-1,y,5,2,c); tft.fillRect(x,y+6,3,2,c);
}
// 눈물 (눈 바로 아래에 떨어지는 물방울)
void drawTear(int x,int y){
  tft.fillRect(x,y,  2,5,ST77XX_CYAN);
  tft.fillRect(x-1,y,4,2,ST77XX_CYAN);
}
// 음표
void drawNote(int x,int y,uint16_t c){
  tft.fillRect(x,y,2,7,c); tft.fillRect(x-3,y+5,5,4,c);
}
// 소용돌이 (나루토 어묵)
void drawSwirl(int cx,int cy,uint16_t c){
  tft.drawRoundRect(cx-5,cy-5,10,10,5,c);
  tft.drawRoundRect(cx-3,cy-3, 6, 6,3,c);
  tft.fillRect(cx-1,cy-1,2,2,c);
  tft.fillRect(cx+3,cy,3,1,c);
}
// 빨간 X 표시
void drawXmark(int cx,int cy){
  tft.drawLine(cx-4,cy-4,cx+4,cy+4,ST77XX_RED);
  tft.drawLine(cx+4,cy-4,cx-4,cy+4,ST77XX_RED);
  tft.drawLine(cx-3,cy-4,cx+5,cy+4,ST77XX_RED);
  tft.drawLine(cx+5,cy-4,cx-3,cy+4,ST77XX_RED);
}

// ── D자 흰자 그리기 헬퍼 ─────────────────────────────────────────────
// 흰자 = 직사각형(backbone) + 원(곡선부분) 합집합
// → 왼쪽은 fillRect로 완전 평평하게, 오른쪽은 fillRoundRect 원의 곡선
// 두 눈 모두 flat LEFT + round RIGHT → 나란히 놓이면 "DD"
void drawDEye(int x, uint16_t col){
  tft.fillRect(x, EY, EW/2, EH, col);          // 백본 (왼쪽 평평면 확보)
  tft.fillRoundRect(x, EY, EW, EH, EH/2, col); // 원 (오른쪽 곡선)
}

// ══════════════════════════════════════════════════════════════════════
void drawCharacter(byte st){

  // ── 팔 (얇고 몸에 딱 붙임, 겹침 허용) ───────────────────────────
  tft.fillRoundRect(HX-15, BY+4, 5,7, 2, 0x0000);  // 왼팔 1px 왼쪽
  tft.fillRoundRect(HX+10, BY+4, 5,7, 2, 0x0000);
  tft.fillRoundRect(HX-14, BY+5, 3,5, 1, C_BODY);
  tft.fillRoundRect(HX+11, BY+5, 3,5, 1, C_BODY);
  // ── 다리 돌기 ──────────────────────────────────────────────────────
  tft.fillRoundRect(HX-9, BY+14, 7,7, 3, 0x0000);
  tft.fillRoundRect(HX+2, BY+14, 7,7, 3, 0x0000);
  tft.fillRoundRect(HX-8, BY+15, 5,5, 2, C_BODY);
  tft.fillRoundRect(HX+3, BY+15, 5,5, 2, C_BODY);
  // ── 몸통 ──────────────────────────────────────────────────────────
  tft.fillRoundRect(HX-12, BY-1, 24,17, 9, 0x0000);
  tft.fillRoundRect(HX-11, BY,   22,15, 8, C_BODY);

  // ── 머리 (몸통 위에 그려 이음새 가림) ────────────────────────────
  tft.fillRoundRect(HX-HR-1,HY-HR-1,(HR+1)*2,(HR+1)*2,HR+1, 0x0000); // outline
  tft.fillRoundRect(HX-HR,  HY-HR,  HR*2,    HR*2,    HR,   C_BODY);  // fill
  tft.fillRoundRect(HX-12,HY-HR+3,18,7,3, C_LITE);   // 하이라이트

  // ── 눈 — 흰자가 D자 모양 ─────────────────────────────────────────
  // drawDEye: 왼쪽 평평 + 오른쪽 곡선 → 두 눈 = "DD"
  if(st==0){
    // HAPPY: ^^ — 24px 박스 안 좌우 대칭 아치
    for(int i=0;i<2;i++){
      int x=(i==0)?LX:RX;
      tft.fillRect(x,    EY+14, 4,7, ST77XX_GREEN);  // 왼 끝
      tft.fillRect(x+4,  EY+8,  4,7, ST77XX_GREEN);  // 왼 중
      tft.fillRect(x+8,  EY+3,  8,6, ST77XX_GREEN);  // 꼭대기 (8px 대칭)
      tft.fillRect(x+16, EY+8,  4,7, ST77XX_GREEN);  // 오른 중
      tft.fillRect(x+20, EY+14, 4,7, ST77XX_GREEN);  // 오른 끝
    }
  } else if(st==1){
    // NORMAL: D자 흰자 + D자 동공 + 반짝이
    drawDEye(LX, 0xFFFF); drawDEye(RX, 0xFFFF);
    // D자 동공: backbone(왼쪽 평평) + 원(오른쪽 곡선), 검정
    tft.fillRect(LX+3, EY+2, 8,20, 0x0000);
    tft.fillRoundRect(LX+3,EY+2,16,20,8, 0x0000);
    tft.fillRect(LX+4, EY+3, 5,5, 0xFFFF);  // 반짝이
    tft.fillRect(RX+3, EY+2, 8,20, 0x0000);
    tft.fillRoundRect(RX+3,EY+2,16,20,8, 0x0000);
    tft.fillRect(RX+4, EY+3, 5,5, 0xFFFF);
  } else if(st==2){
    // TIRED: D자 흰자 + D자 동공 + 눈꺼풀
    drawDEye(LX, 0xFFFF); drawDEye(RX, 0xFFFF);
    tft.fillRect(LX+3, EY+2, 8,20, 0x0000);
    tft.fillRoundRect(LX+3,EY+2,16,20,8, 0x0000);
    tft.fillRect(LX+4, EY+3, 5,5, 0xFFFF);
    tft.fillRect(RX+3, EY+2, 8,20, 0x0000);
    tft.fillRoundRect(RX+3,EY+2,16,20,8, 0x0000);
    tft.fillRect(RX+4, EY+3, 5,5, 0xFFFF);
    // 눈꺼풀 (위 절반 덮기)
    tft.fillRect(LX, EY, EW/2, EH/2+1, C_BODY);
    tft.fillRoundRect(LX,EY,EW,EH/2+1,EH/2, C_BODY);
    tft.fillRect(RX, EY, EW/2, EH/2+1, C_BODY);
    tft.fillRoundRect(RX,EY,EW,EH/2+1,EH/2, C_BODY);
    tft.drawFastHLine(LX, EY+EH/2, EW, 0x0000);
    tft.drawFastHLine(RX, EY+EH/2, EW, 0x0000);
  } else if(st==3){
    // SICK: 흰자 없음 — 얼굴 위에 바로 빨간 X
    tft.drawLine(LX,      EY,    LX+EW-1,EY+EH, ST77XX_RED);
    tft.drawLine(LX+EW-1, EY,    LX,     EY+EH, ST77XX_RED);
    tft.drawLine(LX+1,    EY,    LX+EW,  EY+EH, ST77XX_RED);
    tft.drawLine(LX+EW,   EY,    LX+1,   EY+EH, ST77XX_RED);
    tft.drawLine(RX,      EY,    RX+EW-1,EY+EH, ST77XX_RED);
    tft.drawLine(RX+EW-1, EY,    RX,     EY+EH, ST77XX_RED);
    tft.drawLine(RX+1,    EY,    RX+EW,  EY+EH, ST77XX_RED);
    tft.drawLine(RX+EW,   EY,    RX+1,   EY+EH, ST77XX_RED);
  } else {
    // CRYING: TIRED 눈(반감긴) + 눈물 고임 + 줄기
    drawDEye(LX, 0xFFFF); drawDEye(RX, 0xFFFF);
    // 동공 (TIRED와 동일)
    tft.fillRect(LX+3, EY+2, 8,20, 0x0000);
    tft.fillRoundRect(LX+3,EY+2,16,20,8, 0x0000);
    tft.fillRect(LX+4, EY+3, 5,5, 0xFFFF);
    tft.fillRect(RX+3, EY+2, 8,20, 0x0000);
    tft.fillRoundRect(RX+3,EY+2,16,20,8, 0x0000);
    tft.fillRect(RX+4, EY+3, 5,5, 0xFFFF);
    // 눈꺼풀 (TIRED와 동일)
    tft.fillRect(LX, EY, EW/2, EH/2+1, C_BODY);
    tft.fillRoundRect(LX,EY,EW,EH/2+1,EH/2, C_BODY);
    tft.fillRect(RX, EY, EW/2, EH/2+1, C_BODY);
    tft.fillRoundRect(RX,EY,EW,EH/2+1,EH/2, C_BODY);
    tft.drawFastHLine(LX, EY+EH/2, EW, 0x0000);
    tft.drawFastHLine(RX, EY+EH/2, EW, 0x0000);
    // 눈물 고임 (눈 아랫부분 하늘색 덮기)
    tft.fillRect(LX,    EY+EH-5, EW/2, 5, ST77XX_CYAN);
    tft.fillRoundRect(LX, EY+EH-5, EW, 5, EH/2, ST77XX_CYAN);
    tft.fillRect(RX,    EY+EH-5, EW/2, 5, ST77XX_CYAN);
    tft.fillRoundRect(RX, EY+EH-5, EW, 5, EH/2, ST77XX_CYAN);
    // 눈물 줄기
    tft.fillRect(LX+9,  EY+EH, 3,9, ST77XX_CYAN);
    tft.fillRect(RX+11, EY+EH, 3,9, ST77XX_CYAN);
  }

  // ── 코 (작게) ────────────────────────────────────────────────────
  tft.fillRoundRect(HX-2, EY+EH+2, 4,3, 1, 0xFBA0);

  // ── 볼 홍조 (HAPPY·NORMAL) — 타원형 ─────────────────────────────
  if(st<=1){
    tft.fillRoundRect(HX-HR+4,  EY+EH,   12,8, 4, C_BLUSH);
    tft.fillRoundRect(HX+HR-16, EY+EH,   12,8, 4, C_BLUSH);
  }

  // ── 입 (작고 HX 중심 대칭) ───────────────────────────────────────
  const int MY=EY+EH+9;
  if(st==0){
    // U 스마일 — ±9px 대칭
    tft.fillRect(HX-9, MY,   3,2, ST77XX_GREEN);
    tft.fillRect(HX-6, MY+3, 3,2, ST77XX_GREEN);
    tft.fillRect(HX-3, MY+5, 6,2, ST77XX_GREEN);
    tft.fillRect(HX+3, MY+3, 3,2, ST77XX_GREEN);
    tft.fillRect(HX+6, MY,   3,2, ST77XX_GREEN);
  } else if(st==1){
    // 일자 — 10px 대칭
    tft.fillRect(HX-5, MY+2, 10,2, 0x0000);
  } else if(st==2){
    // 찡그림 — ±9px 대칭
    tft.fillRect(HX-9, MY+5, 3,2, ST77XX_YELLOW);
    tft.fillRect(HX-6, MY+2, 3,2, ST77XX_YELLOW);
    tft.fillRect(HX-3, MY,   6,2, ST77XX_YELLOW);
    tft.fillRect(HX+3, MY+2, 3,2, ST77XX_YELLOW);
    tft.fillRect(HX+6, MY+5, 3,2, ST77XX_YELLOW);
  } else if(st==3){
    // 지그재그 (아픔)
    tft.drawLine(HX-9,MY+1,HX-3,MY+5, ST77XX_RED);
    tft.drawLine(HX-3,MY+5,HX+3,MY+1, ST77XX_RED);
    tft.drawLine(HX+3,MY+1,HX+9,MY+5, ST77XX_RED);
    tft.drawLine(HX-8,MY+2,HX-2,MY+6, ST77XX_RED);
    tft.drawLine(HX-2,MY+6,HX+4,MY+2, ST77XX_RED);
    tft.drawLine(HX+4,MY+2,HX+10,MY+6,ST77XX_RED);
  } else {
    // CRYING: 찡그린 입 (TIRED와 같은 형태, 하늘색)
    tft.fillRect(HX-9, MY+5, 3,2, ST77XX_CYAN);
    tft.fillRect(HX-6, MY+2, 3,2, ST77XX_CYAN);
    tft.fillRect(HX-3, MY,   6,2, ST77XX_CYAN);
    tft.fillRect(HX+3, MY+2, 3,2, ST77XX_CYAN);
    tft.fillRect(HX+6, MY+5, 3,2, ST77XX_CYAN);
  }

  // ── 이펙트 — 6개 고정 그리드
  // 1열 y=30 (+10), 2열 y=62 (+5), 3열 y=94 (유지)
  if(st==0){
    drawHeart( 14, 30, ST77XX_RED);        // 왼1열 하트
    drawStar(  14, 62, 5, ST77XX_YELLOW);  // 왼2열 별 (중앙=(30+94)/2=62)
    // 왼3열 클로버 (y=94)
    tft.fillRoundRect( 9,94, 5,5,2, ST77XX_GREEN);
    tft.fillRoundRect(14,94, 5,5,2, ST77XX_GREEN);
    tft.fillRoundRect( 9,99, 5,5,2, ST77XX_GREEN);
    tft.fillRoundRect(14,99, 5,5,2, ST77XX_GREEN);
    tft.fillRect(13,104,2,3, ST77XX_GREEN);
    // 오른1열 클로버 (y=30)
    tft.fillRoundRect(108,30, 5,5,2, ST77XX_GREEN);
    tft.fillRoundRect(113,30, 5,5,2, ST77XX_GREEN);
    tft.fillRoundRect(108,35, 5,5,2, ST77XX_GREEN);
    tft.fillRoundRect(113,35, 5,5,2, ST77XX_GREEN);
    tft.fillRect(112,40,2,3, ST77XX_GREEN);
    drawStar( 113, 62, 5, ST77XX_YELLOW);  // 오른2열 별 (중앙=62)
    drawHeart(113, 94, ST77XX_RED);         // 오른3열 하트 (y=94)
  } else if(st==1){
    drawSwirl( 14, 30, 0xFDB7);
    drawSwirl(113, 30, 0xFDB7);
    drawSwirl( 14, 62, 0xFDB7);
    drawSwirl(113, 62, 0xFDB7);
    drawSwirl( 14, 94, 0xFDB7);
    drawSwirl(113, 94, 0xFDB7);
  } else if(st==2){
    tft.setTextSize(1); tft.setTextColor(C_DIM);
    tft.setCursor( 11, 30); tft.print("Z");
    tft.setCursor(111, 30); tft.print("Z");
    tft.setCursor( 11, 62); tft.print("Z");
    tft.setCursor(111, 62); tft.print("Z");
    tft.setCursor( 11, 94); tft.print("Z");
    tft.setCursor(111, 94); tft.print("Z");
  } else if(st==3){
    drawXmark( 14, 30);
    drawXmark(113, 30);
    drawXmark( 14, 62);
    drawXmark(113, 62);
    drawXmark( 14, 94);
    drawXmark(113, 94);
  } else {
    drawTear( 11, 30);
    drawTear(112, 30);
    drawTear( 11, 62);
    drawTear(112, 62);
    drawTear( 11, 94);
    drawTear(112, 94);
  }
}

// ══════════════════════════════════════════════════════════════════════
void drawBottomBar(byte st){
  tft.fillRect(0,118,128,42, C_BAR);
  tft.drawFastHLine(0,118,128, C_EDGE);
  tft.setTextSize(1);

  if(stockCount>0){
    uint16_t stc[]={ST77XX_GREEN,0xFFFF,ST77XX_YELLOW,ST77XX_RED,ST77XX_CYAN};
    uint16_t col = stc[st];

    // ── 줄1: 종목명(왼) + 등락률(오른) ─────────────────────────────
    tft.setTextColor(0xFFFF);
    tft.setCursor(5,122); tft.print(stocks[stockIdx].name);

    char pct[12]; snprintf(pct,12,"%+.2f%%",stocks[stockIdx].pct);
    tft.setTextColor(col);
    tft.setCursor(127-(int)strlen(pct)*6, 122); tft.print(pct);

    // ── 구분선 ───────────────────────────────────────────────────────
    tft.drawFastHLine(5,132,118, C_EDGE);

    // ── 줄2: 현재가 ──────────────────────────────────────────────────
    char price[20];
    formatPrice(price,20, stocks[stockIdx].unit, stocks[stockIdx].price);
    tft.setTextColor(C_DIM);
    tft.setCursor(5,136); tft.print(price);

    // ── 줄3: 페이지 도트(중앙) + 인덱스(우) ─────────────────────────
    int dotTotal = stockCount*7-2;
    int dotX = (128-dotTotal)/2;
    for(int i=0;i<stockCount&&i<8;i++){
      int dx=dotX+i*7;
      if(i==stockIdx) tft.fillRoundRect(dx,149,5,5,2, 0xFFFF);
      else            tft.drawRoundRect(dx,149,5,5,2, C_DIM);
    }

  } else {
    tft.setTextColor(C_DIM);
    tft.setCursor(5,128); tft.print(F("Waiting for data..."));
    tft.setCursor(5,142); tft.print(F("Connect BLE"));
  }
}

// ══════════════════════════════════════════════════════════════════════
void draw(){
  byte st=stateOf(stockIdx);
  tft.fillScreen(C_BG);

  // ── 상단 바 ──────────────────────────────────────────────────────
  tft.fillRect(0,0,128,15, C_BAR);
  tft.drawFastHLine(0,15,128, C_EDGE);
  tft.setTextSize(1);

  // 타이틀 — "Nune" 흰색, "DD" 하늘색, "ine" 흰색
  tft.setTextColor(0xFFFF);  tft.setCursor(3,4);  tft.print(F("Nune"));
  tft.setTextColor(ST77XX_CYAN); tft.setCursor(27,4); tft.print(F("DD"));
  tft.setTextColor(0xFFFF);  tft.setCursor(39,4); tft.print(F("ine"));

  // 무음 아이콘 (BT 왼쪽) — 스피커 모양 + X
  tft.fillRect(101,3,14,9, C_BAR);
  uint16_t sc = silentMode ? ST77XX_RED : C_DIM;
  tft.fillRect(102,5,3,5, sc);   // 스피커 몸통 (사각형)
  tft.fillRect(105,5,1,5, sc);   // 콘 좁은 부분
  tft.fillRect(106,4,1,7, sc);   // 콘 퍼지는 부분
  if(silentMode){
    tft.drawLine(108,4,111,8, ST77XX_RED);
    tft.drawLine(111,4,108,8, ST77XX_RED);
  }

  // BT 상태
  if(bleConnected){
    tft.fillRoundRect(116,5, 6,6, 3, ST77XX_CYAN);
  } else {
    tft.drawLine(115,4,120,9, ST77XX_RED);
    tft.drawLine(120,4,115,9, ST77XX_RED);
  }

  drawCharacter(st);
  drawBottomBar(st);
}

// ══════════════════════════════════════════════════════════════════════
void setup(){
  Serial.begin(115200);
  pinMode(BTN,INPUT_PULLUP); pinMode(BTN_MUTE,INPUT_PULLUP);
  pinMode(BUZZER,OUTPUT); digitalWrite(BUZZER,LOW);
  tft.initR(INITR_BLACKTAB); tft.setSPISpeed(4000000); tft.setRotation(0);
  BLEDevice::init("NuneDDine"); BLEDevice::setMTU(512);
  BLEServer*srv=BLEDevice::createServer(); srv->setCallbacks(new ServerCallbacks());
  BLEService*svc=srv->createService(SERVICE_UUID);
  BLECharacteristic*chr=svc->createCharacteristic(
    CHAR_UUID,BLECharacteristic::PROPERTY_WRITE|BLECharacteristic::PROPERTY_WRITE_NR);
  chr->setCallbacks(new CharCallbacks()); svc->start();
  BLEAdvertising*adv=BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID); adv->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("BLE ready"); draw();
}

void loop(){
  if(digitalRead(BTN)==LOW){
    delay(50); while(digitalRead(BTN)==LOW){} delay(50);
    if(stockCount>0){
      byte os=stateOf(stockIdx); stockIdx=(stockIdx+1)%stockCount;
      byte ns=stateOf(stockIdx);
      if(ns==0&&os!=0)beepHappy(); else if(ns>=2&&os<2)beepSad();
    }
    draw();
  }
  static bool lastMute=HIGH;
  bool curMute=digitalRead(BTN_MUTE);
  if(curMute!=lastMute){
    delay(50);
    silentMode=(curMute==LOW);
    if(!silentMode)beep(1000,60);
    draw();
    lastMute=curMute;
  }
  if(dataReceived){dataReceived=false;draw();}
}
