## サーバレス Todo アプリのデプロイ手順（超初心者向け）

このドキュメントは「AWS に初めて触れる」人でも迷わないレベルで、デプロイと動作確認までを説明します。

## 1. 事前準備（AWS 側）

### 1-1. AWS アカウント作成
まだアカウントがない場合は、以下から作成します。
- https://aws.amazon.com/jp/ （「アカウントを作成」）

### 1-2. IAM ユーザーの作成（おすすめ）
本番のルートユーザーは使わず、IAM ユーザーを作成します。
1. AWS 管理コンソールへログイン
2. 検索で **IAM** を開く
3. **ユーザー** → **ユーザーを追加**
4. ユーザー名を入力（例: `todo-deployer`）
5. アクセスキー（**プログラムによるアクセス**）を有効化
6. **ポリシーを直接アタッチ** → **AdministratorAccess** を一時的に付与
   - 学習用途の簡略化のため。後で権限を絞ってもOKです。
7. 作成後に「アクセスキー」と「シークレットキー」を控える

## 2. ローカル環境の準備

### 2-1. AWS CLI のインストール
インストール方法: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

インストール確認:
```bash
aws --version
```

### 2-2. AWS SAM CLI のインストール
インストール方法: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

インストール確認:
```bash
sam --version
```

### 2-3. AWS 認証情報の設定
以下のコマンドでアクセスキーを登録します。
```bash
aws configure
```

入力例:
- AWS Access Key ID: （IAM で作成したキー）
- AWS Secret Access Key: （IAM で作成したシークレット）
- Default region name: `ap-northeast-1`（東京リージョンの例）
- Default output format: `json`

## 3. インフラのデプロイ（SAM）

このプロジェクトでは `infra/template.yaml` を使って以下を一括作成します。
- DynamoDB（テーブル `Todos`）
- Lambda（`backend/lambda.js`）
- API Gateway HTTP API
- S3（静的サイト用バケット）

### 3-1. ビルド
```bash
cd infra
sam build
```

### 3-2. デプロイ
```bash
sam deploy --guided
```

初回だけ質問が出ます。基本は Enter で OK ですが、以下を意識してください。
- Stack Name: 例 `todo-app`
- AWS Region: `ap-northeast-1` など
- Confirm changes before deploy: `Y` でも `N` でもOK
- Allow SAM CLI IAM role creation: `Y`
- Save arguments to samconfig.toml: `Y`（次回以降が楽）

デプロイが成功すると `Outputs` に以下が表示されます。
- `ApiEndpoint`: API の URL
- `WebsiteURL`: フロントを置く S3 の URL

## 4. フロントエンドのアップロード

S3 バケットに `frontend/index.html` をアップロードします。
以下の `<bucket-name>` は **WebsiteURL に含まれるバケット名** に置き換えます。

```bash
aws s3 cp ../frontend/index.html s3://<bucket-name>/index.html
```

アップロードが完了したら、ブラウザで `WebsiteURL` にアクセスしてください。

## 5. API の URL をフロントに設定

`frontend/index.html` の `API_BASE_URL` を `ApiEndpoint` の値に変更します。
例:
```js
const API_BASE_URL = "https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com";
```

変更後にもう一度 S3 へアップロードしてください。
```bash
aws s3 cp ../frontend/index.html s3://<bucket-name>/index.html
```

## 6. 動作確認
1. `WebsiteURL` にアクセス
2. タイトルを入力して「Add」
3. チェックボックスで完了状態が切り替わるか確認
4. Delete ボタンで削除されるか確認

## 7. DynamoDB の確認方法（コンソール）
1. AWS 管理コンソール → DynamoDB
2. テーブル `Todos` を選択
3. **アイテムの探索** から Todo データが入っているか確認

## 8. テーブルだけ作りたい場合（手動）
SAM を使わず、DynamoDB だけ先に作る場合の例です。
```bash
aws dynamodb create-table \
  --table-name Todos \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --region ap-northeast-1
```

Lambda 側には環境変数 `TABLE_NAME=Todos` を渡す必要があります。

## 9. 補足: DynamoDB テーブル仕様
- テーブル名: `Todos`
- 主キーは 2 本セット
  - `pk` (Partition key): `"default"` を固定で入れる
  - `sk` (Sort key): `todo#{id}` 形式
- 課金モード: `PAY_PER_REQUEST`
