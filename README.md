# 就労作業・工賃記録アプリ

就労継続支援B型の通所・在宅作業について、作業時間と工賃を記録するための個人用Webアプリです。データはこのブラウザのLocalStorageに保存され、サーバーやログインは必要ありません。

## 起動方法

このフォルダの `index.html` をSafariまたはChromeで開いてください。ローカルWebサーバーを使う場合は、フォルダで次を実行して `http://localhost:8000` を開きます。

```sh
python3 -m http.server 8000
```

## 使い方

1. 画面下部の「工賃の設定」で時間あたりの工賃と皆勤手当を確認・変更します（初期値は200円、5,000円）。
2. 日付、形態、開始・終了時刻、休憩時間を入力して「記録を登録する」を押します。
3. 月の矢印で表示月を切り替え、月間の合計を確認します。
4. 一覧の「編集」「削除」から登録済み記録を変更できます。

## 注意

- 皆勤手当は、土日を除く平日すべてに作業記録がある月だけ、最終営業日に加算されます。平日の祝日も営業日として扱います。月途中は「未確定」、過去の営業日に未出席があれば0円です。
- ブラウザのサイトデータを消去すると記録も消えます。将来のバックアップ機能に備え、保存処理は `storage.js` にまとめています。
- `tests.html` をブラウザで開くと、作業時間・工賃・月間集計のロジックテストを確認できます。

## Mac・iPhoneのクラウド同期（Supabase）

1. [Supabase](https://supabase.com/) で無料プロジェクトを作ります。
2. Dashboard の **SQL Editor** で [supabase-setup.sql](./supabase-setup.sql) の内容を実行します。
3. **Authentication → Providers → Email** で Email を有効にします。**Authentication → URL Configuration** の Site URL と Redirect URLs に、公開URL（例: `https://あなたのID.github.io/work-wage-record/`）を設定します。
4. **Project Settings → API** の Project URL と `anon public` key を [cloud-config.js](./cloud-config.js) に貼り付けます。`service_role` key は絶対に貼り付けないでください。
5. 公開済みアプリでメールアドレスを入力し、届いたリンクを開いてログインします。MacとiPhoneで同じメールアドレスを使うと、記録・設定が同期されます。
