# SHUBO DIVE — 3D FLIGHT v2.1

探索艇の後方から、巨大な米の峡谷へ潜航する3Dシューティング。機体・敵・弾・救出地点はXYZの立体空間を共有し、上下に操縦できる。米の壁は移動と射線を遮る。

ネイティブWebGL。多孔質の米、白い菌糸、紫の酵母、探索艇、霧、光、テクスチャをコードから生成する。ゲーム本体は外部依存なしで動き、配布物は全ソースを埋め込んだ **`dist/index.html` 一枚**。公開GitHub Pagesでは、依頼された流入・回遊計測のためGA4（`G-3L1Q0VYVRH`）だけを任意読み込みし、ローカル起動では送信しない。

## ブラウザで遊ぶ

**[SHUBO DIVEを開く](https://toraikura.github.io/shubo-dive/)**

スマホ・PCのWebGL対応ブラウザでプレイ。ログイン・インストール不要。SATやSNSからもこのURLへリンクできます。進行と設定は利用中のブラウザに保存されます。

公開先はGitHub Pages。`main`への更新時にコード検証とビルドを行い、合格した`dist/`だけを配信します。配信状態は[Actions](https://github.com/Toraikura/shubo-dive/actions/workflows/pages.yml)で確認できます。

## 起動

PCでは `dist/index.html` をブラウザで開く。ローカルHTTPプレビュー：

```sh
python3 -m http.server 8769 --bind 127.0.0.1 --directory dist
```

http://127.0.0.1:8769/ は起動したPC内のアドレス。別のスマホ・PCには上記の公開URLを共有してください。

## 操縦

機体は向いている方向へ自動で前進する。前方の敵へ自動射撃。

| 操作 | PC | スマホ |
| --- | --- | --- |
| 左右旋回 | A / D、← / → | 左スティックを左右 |
| 上昇・下降 | W / S、↑ / ↓ | 左スティックを上下 |
| 画面から機首を向ける | ドラッグ | ドラッグ |
| 前進 / 停止 | B、またはShiftを押している間停止 | 停止 / 前進ボタン |
| ブースト | Space | ブーストボタン |
| 衝撃波 | E | 衝撃波ボタン |
| 一時停止 | Esc / P | 右上のⅡ |

3海域の救出・撃退目標を達成し、最終ボスを撃破して帰還。強化・結果・再挑戦・途中保存を含む。設定には画質、音、難易度、アニメーションON/OFF、動きを減らす項目がある。

## 軽量化

画面外の形状を除外し、画面上で小さく見える物だけ細分数を減らす。機体・敵・弾・酵母のアニメーションとゲーム進行は従来どおり。発光は低解像度でぼかし、描画用の配列とバッファを再利用する。

設定の「描画負荷を自動調整」は初期ON。標準・精細で重い状態が続いた時だけ3D画面の解像度を段階的に下げ、余裕が戻れば復元する。HUDとボタンの解像度は変えない。効果がない場合も元へ戻し、調整を一時的に控える。

比較方法と限定条件は `docs/PERFORMANCE.md`。

## 制作・コード検証

```sh
python3 build.py
node tests/verify.cjs
node tests/app-flow.cjs
node tests/campaign.cjs
node tests/render-contract.cjs
node tests/render-optimization.cjs
```

編集元は `src/`。ビルドはPython標準機能、検証はNode標準機能のみ。ゲーム実行には不要。

保存は `shubo.dive.v2`。旧 `shubo.dive.v1` がある場合、強化・記録・救出状況を引き継いで安全な入口から再開する。旧キーと育成版 `shubo-world` は変更しない。

WebGLの拡張がない場合も通常の3D描画を使う。WebGLそのものを開始できない場合は案内を表示し、見えない状態で戦闘を開始しない。

ユーザー指定に従い、今回は制作・コード検証まで。**ブラウザ表示、GPU、タッチの操作感、実機FPSは未検証。** 詳細は `docs/GAME.md` / `docs/VERIFICATION.md`。
