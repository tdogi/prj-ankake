# Project Ankake

盤面上でクリーチャーを進軍させ、拠点の制圧を目指す1人用（対CPU）デジタルカードゲームのプロトタイプです。

- [ゲームをブラウザでプレイする](https://tdogi.github.io/prj-ankake/)
- [プレイヤーガイド（ルールと遊び方）](./docs/player-guide.md)
- [詳細な基本ルール仕様](./docs/project_ankake_basic_rules_requirements_spec_v1_1.md)

## ローカルで起動する

### 必要なもの

- Node.js 20 以降
- npm（Node.js に同梱）
- Docker Desktop
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

### 手順

リポジトリのルートで次を実行します。

```bash
npm ci
npx supabase start
npm run dev
```

起動メッセージに表示されるURL（通常は <http://127.0.0.1:5173/>）をブラウザで開くとゲームを開始できます。終了するにはターミナルで `Ctrl+C` を押します。

### ローカルオンライン対戦

`npx supabase start` の出力から`Project URL`と`Publishable`を確認し、`.env.example` をコピーして `.env.local` に設定します。ローカル環境では**オンライン対戦**を選ぶと、待機相手を探さずSupabase Edge Function上のCPUとの対戦を作成します。

CPU対戦は `local-cpu-match`、人同士のオンライン対戦は `human-match` Edge Function を経由します。人対人では匿名 Auth による参加者認可と private Realtime Broadcast を使い、ブラウザはサーバーが検証した状態だけを受信します。通信断は 1 分以内なら同じブラウザセッションで再接続でき、超過時は切断側の敗北になります。

```bash
npx supabase stop
```

でローカルSupabaseを停止できます。本番SupabaseのURLやキーはローカル開発用の環境変数へ設定しないでください。

本番ビルドの確認には、次を使用します。

```bash
npm run build
npm run preview
```

## GitHub Pages でプレイする

`main` ブランチへのpushにより、GitHub Actions の **Deploy GitHub Pages** ワークフローがアプリをビルドして公開します。デプロイの完了後、次のURLからプレイできます。

<https://tdogi.github.io/prj-ankake/>

初回のみ、リポジトリの **Settings > Pages** で公開元として **GitHub Actions** を有効にしてください。ワークフローの実行結果は [Actions](https://github.com/tdogi/prj-ankake/actions) で確認できます。

## Supabase Cloud（Free プラン）を構築する

オンライン対戦用の Supabase Cloud Project は Terraform で作成します。構成は Free プランで使える範囲に限定しており、Terraform は有料 Compute サイズや有料アドオンを指定しません。Free 組織で作成した Project は無料の既定 Compute を使用します。

Free プランには、500 MB のデータベース、月 5 GB のエグレス、月 50 万回の Edge Function 呼び出し、Realtime 月 200 万メッセージ／同時 200 接続という上限があります。また、低アクティビティが 7 日間続く Project は停止されます。公開運用前に [Supabase の料金と制限](https://supabase.com/pricing) を確認してください。

### 必要なもの

- Terraform 1.7 以降
- Supabase アカウントと Free 組織（アクティブな Free Project は最大 2 個）
- Supabase CLI（すでにローカル開発で使用）
- Project 作成・設定を許可した Supabase Personal Access Token。トークンは短い有効期限と必要最小限の権限にしてください。

### 1. Terraform の準備

Supabase Dashboard の **Organization Settings > General** から Organization slug を確認します。次に、アクセストークンをシェルの環境変数へ設定します。トークン、DB パスワード、`terraform.tfstate` は Git に含めてはいけません。

```bash
export SUPABASE_ACCESS_TOKEN="your-supabase-management-token"
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
```

`infra/terraform/terraform.tfvars` の `organization_id` と、16 文字以上の固有な `database_password` を設定します。リポジトリを fork した場合は、`site_url` と `redirect_urls` も実際の GitHub Pages URL に変更してください。

以下で Provider を初期化し、差分を確認してから作成します。

```bash
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform plan
terraform -chdir=infra/terraform apply
```

`apply` の完了後、Project 参照 ID・URL・Publishable Key を取得します。Publishable Key はブラウザに配布してよいキーですが、Secret Key や `service_role` Key は絶対にフロントエンドや GitHub Variables に設定しないでください。

```bash
terraform -chdir=infra/terraform output -raw project_ref
terraform -chdir=infra/terraform output -raw project_url
terraform -chdir=infra/terraform output -raw publishable_key
```

複数人で Terraform を運用する前に、機密値を含む State を S3 や HCP Terraform などのアクセス制御されたリモートバックエンドへ移行してください。初期構成はローカル State を前提にしており、`infra/terraform/terraform.tfstate` は Git から除外されています。

### 2. Migration と Edge Function を Cloud Project へ反映する

Cloud Project は作成直後で Migration が未適用です。表示された Project 参照 ID を使って CLI をリンクし、既存の DB 構成と Edge Function を反映します。`supabase link` の実行時には DB パスワードの入力を求められます。

```bash
npm run build:edge-function
npx supabase login
npx supabase link --project-ref "<terraform output の project_ref>"
npx supabase db push
npx supabase functions deploy local-cpu-match
npx supabase functions deploy human-match
```

両 Function は Project 内部の Secret Key を実行環境から使用します。独自の Edge Function Secret を追加しない限り、Secret Key を手動で設定する必要はありません。Supabase Dashboard の **Realtime > Settings** では **Allow public access** を無効にしてください。migration が参加者限定の private Broadcast 認可を設定します。

### 3. GitHub Pages に接続情報を設定する

GitHub リポジトリの **Settings > Secrets and variables > Actions > Variables** に、次の Repository Variables を登録します。

| Variable | 設定値 |
| --- | --- |
| `VITE_SUPABASE_URL` | `terraform output -raw project_url` の出力 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `terraform output -raw publishable_key` の出力 |

`Deploy GitHub Pages` ワークフローはこれらをビルド時に Vite へ渡します。設定後に `main` へ反映すると、公開ページの **オンライン対戦** は Cloud Project の `human-match` Function を使用します。匿名 Auth のセッションは再接続のためブラウザに保存され、待機キャンセル・対戦終了・切断敗北の確定後にアプリ側が匿名ユーザーと対戦データを削除します。ローカル開発用の `.env.local` には Cloud の値を入れず、引き続き `npx supabase start` の接続情報を使ってください。

### 削除と費用に関する注意

Project が不要になった場合だけ、作成した State を保持している環境で次を実行してください。Cloud 上の Project とオンライン対戦データが削除され、復元できない場合があります。

```bash
terraform -chdir=infra/terraform destroy
```

Free プラン上限を超えた場合や、常時稼働・バックアップが必要になった場合は、有料プランへの変更を別途検討してください。Terraform に有料 Compute を追加する変更は、料金を確認してから行ってください。

## 遊び方

ゲームを始めるには、メニューから **デッキ構築** で40枚のデッキを保存し、**CPU対戦** でプレイヤー用・CPU用のデッキと先攻設定を選んでください。詳しい操作とルールは [プレイヤーガイド](./docs/player-guide.md) を参照してください。

## 開発用コマンド

```bash
npm run typecheck
npm test
```
