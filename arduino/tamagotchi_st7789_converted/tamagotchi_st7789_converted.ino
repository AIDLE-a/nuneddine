/*
 * NuneDDine 다마고치 — ESP32-C3 Super Mini + ST7789 + BLE
 * Portrait 240×240 / DD 눈(흰자가 D자 모양) / 1.5등신
 * ★ ST7735 → ST7789로 수정됨
 *
 * 핀: SCLK=4, MOSI=6, CS=7, DC=3, RST=10, BTN=2, BUZZER=5
 */
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>    // ★ ST7735에서 변경
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
#define MAX_STOCKS   6

// ★ ST7789 초기화: CS와 RST로 생성 (MOSI, SCLK는 SPI로 자동 처리)
Adafruit_ST7789 tft(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);

#define C_BG    0x0841
#define C_BODY  0x5DBB
#define C_LITE  0x7EDF
#define C_BAR   0x10A2
#define C_EDGE  0x3D63
#define C_DIM   0x7BEF
#define C_BLUSH 0xFBAD

// ★ 240x240으로 중앙 배치
#define HX 120
#define HY 110
#define HR 50
#define BY (HY+HR-8)   // 몸통 시작 y=152

// 눈: 왼쪽 D, 오른쪽 D — 40×40, 사이 간격 8px
#define EW 40
#define EH 40
#define LX (HX-EW-4)   // 76
#define RX (HX+4)      // 124
#define EY (HY-35)     // 75

// BLE 데이터 형식: "Name,pct,price,unit,buyPrice,buyQty|..."
struct Stock { char name[10]; float pct; float price; char unit[2]; float buyPrice; int buyQty; };
Stock stocks[MAX_STOCKS];
int   stockCount=0, stockIdx=0;
bool  bleConnected=false, dataReceived=false, silentMode=false;

// 0=HAPPY  1=NORMAL  2=TIRED  3=SICK  4=CRYING  5=SEMI-HAPPY
byte stateOf(int i){
  if(!stockCount) return 1;
  float p = stocks[i].pct;
  if(p >  5.0f)  return 0;  // +5% 초과
  if(p >  2.0f)  return 5;  // +2~+5%
  if(p > -2.0f)  return 1;  // -2~+2%
  if(p > -5.0f)  return 2;  // -5~-2%
  if(p > -10.0f) return 4;  // -10~-5%
  return 3;                  // -10% 미만
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
      char nm[10]="",cu[2]="$"; float pct=0,price=0,buyPrice=0; int buyQty=0;
      sscanf(e,"%9[^,],%f,%f,%1[^,],%f,%d",nm,&pct,&price,cu,&buyPrice,&buyQty);
      strncpy(stocks[stockCount].name,nm,9);
      stocks[stockCount].pct=pct; stocks[stockCount].price=price;
      strncpy(stocks[stockCount].unit,cu,1);
      stocks[stockCount].buyPrice=buyPrice; stocks[stockCount].buyQty=buyQty;
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

  // ── 팔 ───────────────────────────────────────────────────────────
  tft.fillRoundRect(HX-25, BY+7, 8,12, 3, 0x0000);
  tft.fillRoundRect(HX+17, BY+7, 8,12, 3, 0x0000);
  tft.fillRoundRect(HX-23, BY+9, 5, 8, 2, C_BODY);
  tft.fillRoundRect(HX+18, BY+9, 5, 8, 2, C_BODY);
  // ── 다리 돌기 ─────────────────────────────────────────────────────
  tft.fillRoundRect(HX-15, BY+24, 12,12, 5, 0x0000);
  tft.fillRoundRect(HX+3,  BY+24, 12,12, 5, 0x0000);
  tft.fillRoundRect(HX-14, BY+26,  8, 8, 3, C_BODY);
  tft.fillRoundRect(HX+4,  BY+26,  8, 8, 3, C_BODY);
  // ── 몸통 ──────────────────────────────────────────────────────────
  tft.fillRoundRect(HX-20, BY-2, 40,28, 15, 0x0000);
  tft.fillRoundRect(HX-19, BY,   37,25, 13, C_BODY);

  // ── 머리 ──────────────────────────────────────────────────────────
  tft.fillRoundRect(HX-HR-2,HY-HR-2,(HR+2)*2,(HR+2)*2,HR+2, 0x0000);
  tft.fillRoundRect(HX-HR,  HY-HR,  HR*2,    HR*2,    HR,   C_BODY);
  tft.fillRoundRect(HX-20,HY-HR+5, 30,12, 5, C_LITE);  // 하이라이트

  // ── 눈 — 흰자가 D자 모양 ─────────────────────────────────────────
  // drawDEye: 왼쪽 평평 + 오른쪽 곡선 → 두 눈 = "DD"
  if(st==0){
    // HAPPY: ^^
    for(int i=0;i<2;i++){
      int x=(i==0)?LX:RX;
      tft.fillRect(x,    EY+23, 6,11, ST77XX_GREEN);
      tft.fillRect(x+6,  EY+13, 6,11, ST77XX_GREEN);
      tft.fillRect(x+12, EY+5, 13,10, ST77XX_GREEN);
      tft.fillRect(x+25, EY+13, 6,11, ST77XX_GREEN);
      tft.fillRect(x+31, EY+23, 6,11, ST77XX_GREEN);
    }
  } else if(st==5){
    // SEMI-HAPPY: D자 눈 + 작은 미소
    drawDEye(LX, 0xFFFF); drawDEye(RX, 0xFFFF);
    tft.fillRect(LX+5, EY+3, 13,32, 0x0000);
    tft.fillRoundRect(LX+5,EY+3,26,32,13, 0x0000);
    tft.fillRect(LX+7, EY+5,  8, 8, 0xFFFF);
    tft.fillRect(RX+5, EY+3, 13,32, 0x0000);
    tft.fillRoundRect(RX+5,EY+3,26,32,13, 0x0000);
    tft.fillRect(RX+7, EY+5,  8, 8, 0xFFFF);
  } else if(st==1){
    // NORMAL: D자 흰자 + 동공 + 반짝이
    drawDEye(LX, 0xFFFF); drawDEye(RX, 0xFFFF);
    tft.fillRect(LX+5, EY+3, 13,32, 0x0000);
    tft.fillRoundRect(LX+5,EY+3,26,32,13, 0x0000);
    tft.fillRect(LX+7, EY+5,  8, 8, 0xFFFF);
    tft.fillRect(RX+5, EY+3, 13,32, 0x0000);
    tft.fillRoundRect(RX+5,EY+3,26,32,13, 0x0000);
    tft.fillRect(RX+7, EY+5,  8, 8, 0xFFFF);
  } else if(st==2){
    // TIRED: D자 흰자 + 동공 + 눈꺼풀
    drawDEye(LX, 0xFFFF); drawDEye(RX, 0xFFFF);
    tft.fillRect(LX+5, EY+3, 13,32, 0x0000);
    tft.fillRoundRect(LX+5,EY+3,26,32,13, 0x0000);
    tft.fillRect(LX+7, EY+5,  8, 8, 0xFFFF);
    tft.fillRect(RX+5, EY+3, 13,32, 0x0000);
    tft.fillRoundRect(RX+5,EY+3,26,32,13, 0x0000);
    tft.fillRect(RX+7, EY+5,  8, 8, 0xFFFF);
    tft.fillRect(LX, EY, EW/2, EH/2+1, C_BODY);
    tft.fillRoundRect(LX,EY,EW,EH/2+1,EH/2, C_BODY);
    tft.fillRect(RX, EY, EW/2, EH/2+1, C_BODY);
    tft.fillRoundRect(RX,EY,EW,EH/2+1,EH/2, C_BODY);
    tft.drawFastHLine(LX, EY+EH/2, EW, 0x0000);
    tft.drawFastHLine(RX, EY+EH/2, EW, 0x0000);
  } else if(st==3){
    // SICK: 빨간 X
    tft.drawLine(LX,      EY,    LX+EW-1,EY+EH, ST77XX_RED);
    tft.drawLine(LX+EW-1, EY,    LX,     EY+EH, ST77XX_RED);
    tft.drawLine(LX+1,    EY,    LX+EW,  EY+EH, ST77XX_RED);
    tft.drawLine(LX+EW,   EY,    LX+1,   EY+EH, ST77XX_RED);
    tft.drawLine(RX,      EY,    RX+EW-1,EY+EH, ST77XX_RED);
    tft.drawLine(RX+EW-1, EY,    RX,     EY+EH, ST77XX_RED);
    tft.drawLine(RX+1,    EY,    RX+EW,  EY+EH, ST77XX_RED);
    tft.drawLine(RX+EW,   EY,    RX+1,   EY+EH, ST77XX_RED);
  } else {
    // CRYING: D자 흰자 + 눈물
    drawDEye(LX, 0xFFFF); drawDEye(RX, 0xFFFF);
    tft.fillRect(LX+5, EY+3, 13,32, 0x0000);
    tft.fillRoundRect(LX+5,EY+3,26,32,13, 0x0000);
    tft.fillRect(LX+7, EY+5,  8, 8, 0xFFFF);
    tft.fillRect(RX+5, EY+3, 13,32, 0x0000);
    tft.fillRoundRect(RX+5,EY+3,26,32,13, 0x0000);
    tft.fillRect(RX+7, EY+5,  8, 8, 0xFFFF);
    tft.fillRect(LX+15, EY+EH, 5,15, ST77XX_CYAN);
    tft.fillRect(RX+17, EY+EH, 5,15, ST77XX_CYAN);
  }

  // ── 코 ───────────────────────────────────────────────────────────
  tft.fillRoundRect(HX-3, EY+EH+4, 6,5, 2, 0xFBA0);

  // ── 볼 홍조 (HAPPY·SEMI-HAPPY·NORMAL) ───────────────────────────
  if(st==0 || st==1 || st==5){
    tft.fillRoundRect(HX-HR+7,  EY+EH, 20,13, 6, C_BLUSH);
    tft.fillRoundRect(HX+HR-27, EY+EH, 20,13, 6, C_BLUSH);
  }

  // ── 입 ───────────────────────────────────────────────────────────
  const int MY=EY+EH+15;
  if(st==0){
    // HAPPY: 큰 U 스마일
    tft.fillRect(HX-15, MY,    5,3, ST77XX_GREEN);
    tft.fillRect(HX-10, MY+5,  5,3, ST77XX_GREEN);
    tft.fillRect(HX-5,  MY+8, 10,3, ST77XX_GREEN);
    tft.fillRect(HX+5,  MY+5,  5,3, ST77XX_GREEN);
    tft.fillRect(HX+10, MY,    5,3, ST77XX_GREEN);
  } else if(st==5){
    // SEMI-HAPPY: 작은 미소
    tft.fillRect(HX-8,  MY+2,  4,3, ST77XX_GREEN);
    tft.fillRect(HX-4,  MY+5,  8,3, ST77XX_GREEN);
    tft.fillRect(HX+4,  MY+2,  4,3, ST77XX_GREEN);
  } else if(st==1){
    tft.fillRect(HX-8, MY+3, 16,3, 0x0000);
  } else if(st==2){
    tft.fillRect(HX-15, MY+8,  5,3, ST77XX_YELLOW);
    tft.fillRect(HX-10, MY+3,  5,3, ST77XX_YELLOW);
    tft.fillRect(HX-5,  MY,   10,3, ST77XX_YELLOW);
    tft.fillRect(HX+5,  MY+3,  5,3, ST77XX_YELLOW);
    tft.fillRect(HX+10, MY+8,  5,3, ST77XX_YELLOW);
  } else if(st==3){
    tft.drawLine(HX-15,MY+2,HX-5, MY+8,  ST77XX_RED);
    tft.drawLine(HX-5, MY+8,HX+5, MY+2,  ST77XX_RED);
    tft.drawLine(HX+5, MY+2,HX+15,MY+8,  ST77XX_RED);
    tft.drawLine(HX-13,MY+3,HX-3, MY+10, ST77XX_RED);
    tft.drawLine(HX-3, MY+10,HX+7,MY+3,  ST77XX_RED);
    tft.drawLine(HX+7, MY+3,HX+17,MY+10, ST77XX_RED);
  } else {
    tft.fillRect(HX-15, MY+8,  5,3, ST77XX_CYAN);
    tft.fillRect(HX-10, MY+3,  5,3, ST77XX_CYAN);
    tft.fillRect(HX-5,  MY,   10,3, ST77XX_CYAN);
    tft.fillRect(HX+5,  MY+3,  5,3, ST77XX_CYAN);
    tft.fillRect(HX+10, MY+8,  5,3, ST77XX_CYAN);
  }

  // ── 이펙트 — 6개 고정 그리드 (★ 240x240에 맞게 조정)
  // 1열 y=50 (+20), 2열 y=120 (+10), 3열 y=180
  if(st==5){
    // SEMI-HAPPY: 작은 별 6개
    drawStar( 25, 50,  6, ST77XX_GREEN);
    drawStar(215, 50,  6, ST77XX_GREEN);
    drawStar( 25, 120, 6, ST77XX_GREEN);
    drawStar(215, 120, 6, ST77XX_GREEN);
    drawStar( 25, 180, 6, ST77XX_GREEN);
    drawStar(215, 180, 6, ST77XX_GREEN);
  } else if(st==0){
    drawHeart( 25, 50, ST77XX_RED);        // 왼1열 하트
    drawStar(  25, 120, 8, ST77XX_YELLOW);  // 왼2열 별
    // 왼3열 클로버
    tft.fillRoundRect( 15,180, 8,8,3, ST77XX_GREEN);
    tft.fillRoundRect(23,180, 8,8,3, ST77XX_GREEN);
    tft.fillRoundRect( 15,188, 8,8,3, ST77XX_GREEN);
    tft.fillRoundRect(23,188, 8,8,3, ST77XX_GREEN);
    tft.fillRect(22,196,3,5, ST77XX_GREEN);
    // 오른1열 클로버
    tft.fillRoundRect(207,50, 8,8,3, ST77XX_GREEN);
    tft.fillRoundRect(215,50, 8,8,3, ST77XX_GREEN);
    tft.fillRoundRect(207,58, 8,8,3, ST77XX_GREEN);
    tft.fillRoundRect(215,58, 8,8,3, ST77XX_GREEN);
    tft.fillRect(214,66,3,5, ST77XX_GREEN);
    drawStar( 215, 120, 8, ST77XX_YELLOW);  // 오른2열 별
    drawHeart(215, 180, ST77XX_RED);         // 오른3열 하트
  } else if(st==1){
    drawSwirl( 25, 50, 0xFDB7);
    drawSwirl(215, 50, 0xFDB7);
    drawSwirl( 25, 120, 0xFDB7);
    drawSwirl(215, 120, 0xFDB7);
    drawSwirl( 25, 180, 0xFDB7);
    drawSwirl(215, 180, 0xFDB7);
  } else if(st==2){
    tft.setTextSize(2); tft.setTextColor(C_DIM);  // (★ 텍스트 크기 증가)
    tft.setCursor( 18, 50); tft.print("Z");
    tft.setCursor(210, 50); tft.print("Z");
    tft.setCursor( 18, 120); tft.print("Z");
    tft.setCursor(210, 120); tft.print("Z");
    tft.setCursor( 18, 180); tft.print("Z");
    tft.setCursor(210, 180); tft.print("Z");
  } else if(st==3){
    drawXmark( 25, 50);
    drawXmark(215, 50);
    drawXmark( 25, 120);
    drawXmark(215, 120);
    drawXmark( 25, 180);
    drawXmark(215, 180);
  } else {
    drawTear( 20, 50);
    drawTear(210, 50);
    drawTear( 20, 120);
    drawTear(210, 120);
    drawTear( 20, 180);
    drawTear(210, 180);
  }
}

// ══════════════════════════════════════════════════════════════════════
void drawBottomBar(byte st){
  // 하단 바: 매수가 있으면 2줄(35px), 없으면 1줄(20px)
  Stock& s = stocks[stockIdx];
  bool hasBuy = (s.buyPrice > 0 && s.buyQty > 0);
  int barH = hasBuy ? 38 : 22;
  int barY = 240 - barH;

  tft.fillRect(0, barY, 240, barH, C_BAR);
  tft.drawFastHLine(0, barY, 240, C_EDGE);
  if(stockCount > 0){
    // 인덱스: 0=HAPPY 1=NORMAL 2=TIRED 3=SICK 4=CRYING 5=SEMI-HAPPY
    uint16_t stc[] = {ST77XX_GREEN, 0xFFFF, ST77XX_YELLOW, ST77XX_RED, ST77XX_CYAN, 0x67E0};
    uint16_t col = stc[st];

    // ── 줄1: 종목명(왼) + 현재가 등락률(오른) — textSize=2 ──────────
    tft.setTextSize(2);
    tft.setTextColor(0xFFFF);
    tft.setCursor(8, barY+4); tft.print(s.name);

    char pct[12]; snprintf(pct, 12, "%+.2f%%", s.pct);
    tft.setTextColor(col);
    tft.setCursor(240-(int)strlen(pct)*12-6, barY+4); tft.print(pct);

    // ── 줄2: 매수가 기준 손익 — textSize=1 ──────────────────────────
    if(hasBuy){
      float gainPct = (s.price - s.buyPrice) / s.buyPrice * 100.0f;
      float gainAmt = (s.price - s.buyPrice) * s.buyQty;
      uint16_t gainCol = (gainPct >= 0) ? ST77XX_GREEN : ST77XX_RED;

      tft.setTextSize(1);
      tft.setTextColor(C_DIM);
      tft.setCursor(8, barY+22); tft.print(F("MyBuy"));

      char gainStr[28];
      if(gainAmt >= 0){
        snprintf(gainStr, 28, "+%.1f%%  +%.0f%s", gainPct, gainAmt, s.unit);
      } else {
        snprintf(gainStr, 28, "%.1f%%  %.0f%s", gainPct, gainAmt, s.unit);
      }
      tft.setTextColor(gainCol);
      tft.setCursor(240-(int)strlen(gainStr)*6-5, barY+22); tft.print(gainStr);
    }
  } else {
    tft.setTextSize(2);
    tft.setTextColor(C_DIM);
    tft.setCursor(8, barY+4); tft.print(F("Waiting..."));
  }
}

// ══════════════════════════════════════════════════════════════════════
void draw(){
  byte st=stateOf(stockIdx);
  tft.fillScreen(C_BG);

  // ── 상단 바 ──────────────────────────────────────────────────────
  tft.fillRect(0,0,240,25, C_BAR);  // (★ 240x240에 맞게 조정)
  tft.drawFastHLine(0,25,240, C_EDGE);
  tft.setTextSize(2);  // (★ 더 큰 텍스트)

  // 타이틀 — "Nune" 흰색, "DD" 하늘색, "ine" 흰색 (textSize=2: 각 글자 12px)
  tft.setTextColor(0xFFFF);      tft.setCursor(10, 6); tft.print(F("Nune")); // 10~57
  tft.setTextColor(ST77XX_CYAN); tft.setCursor(58, 6); tft.print(F("DD"));  // 58~81
  tft.setTextColor(0xFFFF);      tft.setCursor(82, 6); tft.print(F("ine")); // 82~117

  // 무음 아이콘 (BT 왼쪽) — 스피커 모양 + X
  tft.fillRect(180,5,30,15, C_BAR);  // (★ 스케일)
  uint16_t sc = silentMode ? ST77XX_RED : C_DIM;
  tft.fillRect(185,9,5,8, sc);   // 스피커 몸통
  tft.fillRect(190,9,2,8, sc);   // 콘 좁은 부분
  tft.fillRect(192,7,2,12, sc);  // 콘 퍼지는 부분
  if(silentMode){
    tft.drawLine(196,6,202,14, ST77XX_RED);
    tft.drawLine(202,6,196,14, ST77XX_RED);
  }

  // BT 상태
  if(bleConnected){
    tft.fillRoundRect(210,8, 12,12, 5, ST77XX_CYAN);
  } else {
    tft.drawLine(207,7,217,17, ST77XX_RED);
    tft.drawLine(217,7,207,17, ST77XX_RED);
  }

  drawCharacter(st);
  drawBottomBar(st);
}

// ══════════════════════════════════════════════════════════════════════
void setup(){
  Serial.begin(115200);
  pinMode(BTN,INPUT_PULLUP); pinMode(BTN_MUTE,INPUT_PULLUP);
  pinMode(BUZZER,OUTPUT); digitalWrite(BUZZER,LOW);
  
  // ★ ST7789 초기화 (ST7735와 다름)
  tft.init(240, 240);           // 240x240 디스플레이 초기화
  tft.setRotation(0);            // 0=세로(240x240), 1=가로
  tft.setSPISpeed(40000000);     // SPI 속도 (높을수록 빠름)
  
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
      bool wasHappy=(os==0||os==5), isHappy=(ns==0||ns==5);
      if(isHappy&&!wasHappy) beepHappy();
      else if(ns>=2&&ns!=5&&(os==0||os==1||os==5)) beepSad();
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
