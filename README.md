# ドローンサウンド Plus by 川越バイオリン教室

**ドローンサウンド Web 版の実験拡張リポジトリ。**
本家 ([jawari-web](https://github.com/ngmt4amtk-web/jawari-web)) と並行して、和声の種類や音律、音色などを増やしていく場。

**開く**: https://ngmt4amtk-web.github.io/jawari-web-plus/

本家: https://ngmt4amtk-web.github.io/jawari-web/

## 本家との関係

- 初期状態は本家と完全同一コード
- 本家は「教室の生徒に案内する安定版」として保守
- こちら Plus 側で自由に機能追加・UI 変更を試す
- 固まってきたら必要に応じて本家へ逆輸入

## 機能（初期状態）

- **調（主音＋スケール）→ 度数 → ドローン音**の 2 段階選択
- **音律 3 種**: 平均律 / ピタゴラス / 純正律
- **和音構成 6 種**: 単音、1+5、1+8、1+5+8、1+3+5、1+3+5+8 ← ここを拡張予定
- **音色 5 種**: Pure Sine / Warm Pad / Bright Organ / Tambura / Cello Ensemble
- **基準ピッチ**: A=415〜466 Hz ＋ カスタム Hz 主音モード
- **メトロノーム & コード進行**: BPM 20〜300、拍子 2/4・4/4・3/4・3/8・6/8、カウントイン、小節ごと度数×クオリティ
- 完全ローカル動作、`localStorage` 永続化

## 技術

- Vanilla HTML / CSS / JavaScript（ビルドなし）
- Web Audio API の `PeriodicWave` で倍音プロファイルをサンプル精度合成
- Web Audio のオーディオクロックを真の時計にした look-ahead scheduler（drift-free）
- GitHub Pages で配信

## ライセンス

MIT
