# SHUBO DIVE

育成版 SHUBO から分かれた、オフライン対応の3Dシューティング。正本は `dist/index.html`。育成版のファイル・保存キー・配信先は共用しない。

米の群島、麹の峡谷、菌糸の深域を探索艇で進み、酵母を救出して帰還する。ネイティブWebGL、外部依存なし。スマホとPC、キーボード、一時停止、動きを減らす設定、2D代替描画に対応する。

制作・コード検証までが今回の依頼範囲。ブラウザ操作・実機テストは行わない。公開・ストア配信は未実施。

## 起動

PCでは `dist/index.html` をブラウザで開く。ローカルHTTPプレビューは次の通り。

```sh
python3 -m http.server 8769 --bind 127.0.0.1 --directory dist
```

`http://127.0.0.1:8769/` は起動したPC内のプレビュー。他のスマホからこのアドレスでは接続できない。スマホへの配信先の用意は別途行う。

## 制作・検証

```sh
python3 build.py
node tests/verify.cjs
node tests/app-flow.cjs
```

編集するソースは `src/`。配布物はその内容を全て埋め込んだ `dist/index.html`。ビルドにPython標準機能のみ、検証にNode標準機能のみ使用し、ゲーム実行にはどちらも不要。

仕様は `docs/GAME.md`、検証済み／未実施の区分は `docs/VERIFICATION.md` を参照。
