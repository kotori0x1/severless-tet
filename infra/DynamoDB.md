## DynamoDB 設定メモ（初心者向け）

Todo データを保存する DynamoDB テーブルの作り方と使い方をまとめています。コマンドをコピペするだけで動くようにしました。

### テーブルの中身（覚えておくこと）
- テーブル名: `Todos`
- 主キーは 2 本セットです
  - `pk` (Partition key): いつも `"default"` を入れる
  - `sk` (Sort key): `todo#{id}` という文字列（例: `todo#abc123`）
- 課金モード: `PAY_PER_REQUEST`（使った分だけ課金）

### SAM でまとめてデプロイする手順
前提: AWS CLI と AWS SAM CLI がインストールされ、`aws configure` 済み。

```bash
cd infra
sam build
sam deploy --guided
```

プロンプトは基本 Enter で進めれば OK です。デプロイが終わると、以下が表示されます。
- `ApiEndpoint`: フロントが呼び出す API の URL
- `WebsiteURL`: S3 静的サイトの URL

#### フロントエンドのアップロード
テンプレートでは空のバケットだけ作るので、`frontend/index.html` をアップロードしてください。

```bash
aws s3 cp ../frontend/index.html s3://<WebsiteURLに表示されたバケット名>/index.html
```

### テーブルだけを先に作りたい場合（CLI 単体）
リージョンはお好みで変更してください。

```bash
aws dynamodb create-table \
  --table-name Todos \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --region ap-northeast-1
```

Lambda をローカル実行する場合や手動で作ったテーブルを使う場合は、環境変数でテーブル名を渡します。

```bash
export TABLE_NAME=Todos
node backend/lambda.js  # （テスト時の例。実際は AWS Lambda で動きます）
```
