/*
 * NuneDDine 다마고치 — Arduino Uno + ST7735 (BLACKTAB, landscape 160×128)
 * fillCircle 없음 / float 없음 / 함수 중첩 최소화
 *
 * 핀: CS=10, DC=9, RST=8,  버튼=2(반대쪽→GND)
 */

#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>

#define TFT_CS  10
#define TFT_DC   9
#define TFT_RST  8
#define BTN      2

Adafruit_ST7735 tft(TFT_CS, TFT_DC, TFT_RST);

byte          st   = 1;   // 0=happy 1=normal 2=tired 3=sick
byte          prev = 99;
unsigned long lb   = 0;

// ── 색상 (미리 계산된 hex) ───────────────────────────────────────────────
#define C_BODY   0x2946   // 어두운 슬레이트
#define C_EDGE   0x3D63
#define C_DIM    0x7BEF
#define C_BLUSH  0x6000
#define C_BAR    0x10A2
#define C_CYAN   ST77XX_CYAN
#define C_GREEN  ST77XX_GREEN
#define C_YELLOW ST77XX_YELLOW
#define C_RED    ST77XX_RED
#define C_WHITE  0xDEDB

// ════════════════════════════════════════════════════════════════════════
// draw(): 버튼 누를 때만 호출 — 모든 코드가 여기에 flat하게 들어감
// ════════════════════════════════════════════════════════════════════════
void draw() {

  // ── 배경 ──
  tft.fillScreen(ST77XX_BLACK);

  // ── 상단 바 ──
  tft.fillRect(0, 0, 160, 13, C_BAR);
  tft.setTextSize(1);
  tft.setTextColor(C_CYAN);
  tft.setCursor(3, 3);
  tft.print(F("NuneDDine"));
  tft.setTextColor(C_DIM);
  tft.setCursor(105, 3);
  tft.print(F("DEMO"));

  // ── 몸통 (fillRoundRect 사용 — fillCircle 대신) ──
  // 그림자
  tft.fillRoundRect(53, 18, 60, 76, 30, 0x0841);
  // 본체
  tft.fillRoundRect(50, 15, 60, 76, 30, C_BODY);
  // 테두리
  tft.drawRoundRect(50, 15, 60, 76, 30, C_EDGE);
  tft.drawRoundRect(51, 16, 58, 74, 29, C_EDGE);

  // ════ 상태별 표정 ════

  if (st == 0) { // ── HAPPY ──────────────────────────────────────────

    // 볼 홍조
    tft.fillRect(52, 60, 10, 5, C_BLUSH);
    tft.fillRect(98, 60, 10, 5, C_BLUSH);

    // 눈 (^^ 모양 — fillRect 5개로 곡선 표현)
    // 왼쪽 ^^
    tft.fillRect(62, 48, 2, 5, C_GREEN);
    tft.fillRect(64, 46, 2, 3, C_GREEN);
    tft.fillRect(66, 44, 4, 2, C_GREEN);
    tft.fillRect(70, 46, 2, 3, C_GREEN);
    tft.fillRect(72, 48, 2, 5, C_GREEN);
    // 오른쪽 ^^
    tft.fillRect(82, 48, 2, 5, C_GREEN);
    tft.fillRect(84, 46, 2, 3, C_GREEN);
    tft.fillRect(86, 44, 4, 2, C_GREEN);
    tft.fillRect(90, 46, 2, 3, C_GREEN);
    tft.fillRect(92, 48, 2, 5, C_GREEN);

    // 스마일 (계단식 U)
    tft.fillRect(64, 68, 4, 2, C_GREEN);
    tft.fillRect(68, 71, 4, 2, C_GREEN);
    tft.fillRect(72, 73, 16, 2, C_GREEN);
    tft.fillRect(88, 71, 4, 2, C_GREEN);
    tft.fillRect(92, 68, 4, 2, C_GREEN);

  } else if (st == 1) { // ── NORMAL ─────────────────────────────────

    // 눈 (직사각형)
    tft.fillRoundRect(62, 43, 12, 8, 2, C_WHITE);
    tft.fillRoundRect(82, 43, 12, 8, 2, C_WHITE);

    // 일자 입
    tft.fillRect(68, 68, 24, 2, C_DIM);

  } else if (st == 2) { // ── TIRED ──────────────────────────────────

    // 눈 (반쯤 감긴)
    tft.fillRoundRect(62, 45, 12, 6, 2, C_YELLOW);
    tft.fillRoundRect(82, 45, 12, 6, 2, C_YELLOW);
    tft.fillRect(62, 43, 12, 4, C_BODY);  // 눈꺼풀
    tft.fillRect(82, 43, 12, 4, C_BODY);

    // 눈물
    tft.fillRect(73, 51, 2, 8, C_CYAN);

    // 찡그림 (계단식 ∩)
    tft.fillRect(64, 72, 4, 2, C_YELLOW);
    tft.fillRect(68, 70, 4, 2, C_YELLOW);
    tft.fillRect(72, 68, 16, 2, C_YELLOW);
    tft.fillRect(88, 70, 4, 2, C_YELLOW);
    tft.fillRect(92, 72, 4, 2, C_YELLOW);

    // zzz
    tft.setTextColor(C_DIM);
    tft.setTextSize(1);
    tft.setCursor(98, 22);
    tft.print(F("zzz"));

  } else { // ── SICK ───────────────────────────────────────────────────

    // X자 눈
    tft.drawLine(62, 42, 73, 52, C_RED);
    tft.drawLine(73, 42, 62, 52, C_RED);
    tft.drawLine(82, 42, 93, 52, C_RED);
    tft.drawLine(93, 42, 82, 52, C_RED);

    // 삐뚤어진 입
    tft.drawLine(66, 68, 80, 73, C_RED);
    tft.drawLine(80, 73, 94, 68, C_RED);

    // 식은땀 (네모 방울)
    tft.fillRect(97, 22, 4, 7, C_CYAN);
    tft.fillRect(96, 22, 6, 2, C_CYAN);
    tft.fillRect(56, 26, 3, 5, C_CYAN);
    tft.fillRect(55, 26, 5, 2, C_CYAN);
  }

  // ── 하단 상태바 ──
  tft.fillRect(0, 113, 160, 15, C_BAR);
  tft.drawFastHLine(0, 113, 160, C_EDGE);
  tft.setTextSize(1);

  if (st == 0) {
    tft.setTextColor(C_GREEN);
    tft.setCursor(5, 120);
    tft.print(F("HAPPY   Samsung +3.5%"));
  } else if (st == 1) {
    tft.setTextColor(C_WHITE);
    tft.setCursor(5, 120);
    tft.print(F("NORMAL  Samsung +0.2%"));
  } else if (st == 2) {
    tft.setTextColor(C_YELLOW);
    tft.setCursor(5, 120);
    tft.print(F("TIRED   Samsung -1.8%"));
  } else {
    tft.setTextColor(C_RED);
    tft.setCursor(5, 120);
    tft.print(F("SICK    Samsung -7.5%"));
  }

  prev = st;
}

// ════════════════════════════════════════════════════════════════════════
void setup() {
  pinMode(BTN, INPUT_PULLUP);

  tft.initR(INITR_BLACKTAB);
  tft.setSPISpeed(250000);
  tft.setRotation(1);

  draw();
}

void loop() {
  if (digitalRead(BTN) == LOW && millis() - lb > 250) {
    lb = millis();
    st = (st + 1) % 4;
    draw();
  }
}

/*
 * ESP32 교체 시:
 *   - setup()에 WiFi.begin(SSID, PW) 추가
 *   - loop()의 버튼 블록을 fetchPrice() 기반 상태 판단으로 교체
 *   - setSPISpeed(250000)은 ESP32에서 더 높여도 됨 (예: 4000000)
 */
