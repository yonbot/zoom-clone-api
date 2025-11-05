# デプロイ手順書

このドキュメントでは、zoom-clone-apiをHostinger VPSにデプロイする手順を説明します。

## 前提条件

- Hostinger VPSへのSSHアクセス権限
- Node.js 18以上がインストールされていること
- npmまたはyarnがインストールされていること
- PM2がインストールされていること（後述の手順でインストールします）

## 1. VPSへの接続

```bash
ssh user@your-vps-ip
```

## 2. 必要なソフトウェアのインストール

### Node.jsのインストール（未インストールの場合）

```bash
# Node.js 18以上をインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# インストール確認
node --version
npm --version
```

### PM2のインストール

```bash
sudo npm install -g pm2
```

### Gitのインストール（未インストールの場合）

```bash
sudo apt-get update
sudo apt-get install git
```

### ビルドツールのインストール（必須）

**重要**: `sqlite3`などのネイティブモジュールをビルドするために、以下のツールが必要です。
`npm install --production`を実行する前に、必ずインストールしてください。

```bash
# ビルドツール（make, gcc, g++など）をインストール
sudo apt-get update
sudo apt-get install -y build-essential

# Python（node-gypが使用）をインストール
sudo apt-get install -y python3

# その他の必要なツール
sudo apt-get install -y make
```

**エラーが発生した場合**: `npm error gyp ERR! stack Error: not found: make` というエラーが出た場合は、上記のコマンドを実行してから再度 `npm install --production` を実行してください。

## 3. プロジェクトの配置

### 方法A: Gitリポジトリからクローンする場合

```bash
# プロジェクト用のディレクトリを作成
mkdir -p ~/apps
cd ~/apps

# Gitリポジトリからクローン（リポジトリURLを置き換えてください）
git clone https://github.com/your-username/zoom-clone-api.git
cd zoom-clone-api
```

### 方法B: ファイルを直接アップロードする場合

1. ローカルでプロジェクトをzip化
2. SCPまたはFTPでVPSにアップロード
3. VPS上で解凍

```bash
# 例: SCPでアップロード
scp -r ./zoom-clone-api user@your-vps-ip:~/apps/

# VPS上で解凍
cd ~/apps/zoom-clone-api
```

## 4. 依存関係のインストール

**重要**: ビルドにはTypeScriptと型定義ファイル（devDependencies）が必要です。
そのため、まずは全ての依存関係をインストールします。

```bash
cd ~/apps/zoom-clone-api
npm install
```

**注意**: `npm install --production`は使用しないでください。
ビルド後に不要なdevDependenciesを削除したい場合は、ビルド完了後に`npm prune --production`を実行できます。

## 5. 環境変数の設定

`.env`ファイルを作成して、必要な環境変数を設定します。

```bash
nano .env
```

以下の内容を設定してください：

```env
# JWT認証用の秘密鍵（必須）
# ランダムな文字列を生成してください（例: openssl rand -base64 32）
JWT_SECRET=your-secret-key-here

# サーバーポート（デフォルト: 8888）
PORT=8888

# データベース設定（本番環境用）
# TypeORMのエンティティパス（ビルド後はdist配下）
DB_TYPEORM_ENTITIES=dist/**/*.entity.js
DB_TYPEORM_MIGRATIONS=dist/migrations/**/*.js
DB_TYPEORM_SUBSCRIBERS=dist/subscribers/**/*.js

# 本番環境
NODE_ENV=production
```

**重要**: `JWT_SECRET`は強力なランダムな文字列に変更してください。

```bash
# ランダムな秘密鍵を生成
openssl rand -base64 32
```

## 6. プロジェクトのビルド

```bash
# TypeScriptをビルド
npm run build
```

## 7. データベースの初期化

```bash
# データディレクトリを作成
mkdir -p data

# マイグレーションを実行（初回のみ）
npm run migration:run
```

## 8. ログディレクトリの作成

```bash
mkdir -p logs
```

## 9. PM2でアプリケーションを起動

```bash
# PM2でアプリケーションを起動
pm2 start ecosystem.config.js --env production

# PM2の状態を確認
pm2 status

# ログを確認
pm2 logs zoom-clone-api

# PM2の自動起動を設定（サーバー再起動時に自動起動）
pm2 startup
pm2 save
```

## 10. ファイアウォールの設定

ポート8888を開放する必要がある場合：

```bash
# UFWを使用している場合
sudo ufw allow 8888/tcp
sudo ufw reload

# またはiptablesを使用している場合
sudo iptables -A INPUT -p tcp --dport 8888 -j ACCEPT
```

## 11. Nginxリバースプロキシの設定（オプション推奨）

ポート80/443でAPIを公開したい場合、Nginxをリバースプロキシとして設定できます。

### Nginxのインストール

```bash
sudo apt-get update
sudo apt-get install nginx
```

### Nginx設定ファイルの作成

```bash
sudo nano /etc/nginx/sites-available/zoom-clone-api
```

以下の内容を設定：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # ドメイン名を設定

    location / {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket用の設定（Socket.io用）
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### シンボリックリンクの作成と有効化

```bash
sudo ln -s /etc/nginx/sites-available/zoom-clone-api /etc/nginx/sites-enabled/
sudo nginx -t  # 設定ファイルの構文チェック
sudo systemctl reload nginx
```

## 12. SSL証明書の設定（Let's Encrypt、オプション推奨）

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## よく使うPM2コマンド

```bash
# アプリケーションの状態確認
pm2 status

# ログの確認
pm2 logs zoom-clone-api

# アプリケーションの再起動
pm2 restart zoom-clone-api

# アプリケーションの停止
pm2 stop zoom-clone-api

# アプリケーションの削除
pm2 delete zoom-clone-api

# すべてのログをクリア
pm2 flush
```

## トラブルシューティング

### アプリケーションが起動しない場合

1. ログを確認:
   ```bash
   pm2 logs zoom-clone-api
   ```

2. 環境変数が正しく設定されているか確認:
   ```bash
   cat .env
   ```

3. ポートが使用中でないか確認:
   ```bash
   sudo netstat -tulpn | grep 8888
   ```

#### `SyntaxError: Cannot use import statement outside a module` エラー

このエラーは、TypeORMがTypeScriptファイル（`src/**/*.entity.ts`）を読み込もうとしている場合に発生します。

**原因**: 
- 本番環境で環境変数`NODE_ENV=production`が設定されていない
- または、`.env`ファイルが正しく読み込まれていない

**解決方法**:

1. **`.env`ファイルを確認**:
   ```bash
   cat .env
   ```
   `NODE_ENV=production`が設定されているか確認してください。

2. **PM2を再起動**:
   ```bash
   pm2 delete zoom-clone-api
   pm2 start ecosystem.config.js --env production
   ```

3. **ビルドが完了しているか確認**:
   ```bash
   ls -la dist/modules/users/
   ```
   `user.entity.js`ファイルが存在することを確認してください。

4. **コードを再ビルド**:
   ```bash
   npm run build
   pm2 restart zoom-clone-api
   ```

**注意**: 最新のコードでは、`NODE_ENV=production`が設定されていれば自動的に`dist`配下のファイルを使用するようになっています。

### データベースエラーが発生する場合

1. データディレクトリの権限を確認:
   ```bash
   ls -la data/
   ```

2. マイグレーションを再実行:
   ```bash
   npm run migration:run
   ```

### npm installでエラーが発生する場合

#### `npm error gyp ERR! stack Error: not found: make`

このエラーは、ネイティブモジュール（`sqlite3`など）をビルドするために必要なビルドツールが不足している場合に発生します。

**解決方法**:
```bash
# ビルドツールをインストール
sudo apt-get update
sudo apt-get install -y build-essential python3 make

# インストール後、再度実行
npm install
```

#### `npm run build`で型定義エラーが発生する場合

エラー例: `error TS7016: Could not find a declaration file for module 'express'`

このエラーは、devDependencies（TypeScriptと型定義ファイル）がインストールされていない場合に発生します。

**解決方法**:
```bash
# 全ての依存関係（devDependenciesを含む）をインストール
npm install

# その後、再度ビルド
npm run build
```

**重要**: ビルドにはdevDependenciesが必要です。`npm install --production`はビルド前に使用しないでください。

#### `npm ERR! code EACCES` または権限エラー

npmのグローバルパッケージのインストールで権限エラーが発生する場合：

```bash
# npmのグローバルディレクトリの権限を修正
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### npm run buildでエラーが発生する場合

#### TypeScript型定義エラー

エラー例: 
```
error TS7016: Could not find a declaration file for module 'express'
Try `npm i --save-dev @types/express`
```

**原因**: devDependenciesがインストールされていない

**解決方法**:
```bash
# 全ての依存関係をインストール（devDependenciesを含む）
npm install

# ビルドを再実行
npm run build
```

#### その他のビルドエラー

1. TypeScriptのバージョンを確認:
   ```bash
   npx tsc --version
   ```

2. node_modulesをクリーンアップして再インストール:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

### メモリ不足が発生する場合

`ecosystem.config.js`の`max_memory_restart`を調整してください。

## 更新手順

コードを更新した場合の手順：

```bash
# 1. 最新のコードを取得（Git使用の場合）
git pull origin main
# または master ブランチの場合
git pull origin master

# 2. 依存関係を更新（devDependenciesを含む）
npm install

# 3. ビルド
npm run build

# 4. マイグレーション実行（必要に応じて）
npm run migration:run

# 5. PM2で再起動
pm2 restart zoom-clone-api

# 6. （オプション）ビルド後、不要なdevDependenciesを削除する場合
# npm prune --production
```

## セキュリティのベストプラクティス

1. **環境変数の保護**: `.env`ファイルは絶対にGitにコミットしないでください
2. **ファイアウォール**: 必要なポートのみを開放してください
3. **SSL/TLS**: 本番環境では必ずHTTPSを使用してください
4. **定期的な更新**: Node.js、npm、依存パッケージを定期的に更新してください
5. **ログの監視**: 定期的にログを確認して異常がないかチェックしてください

