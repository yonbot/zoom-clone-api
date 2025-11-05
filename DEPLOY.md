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

### UFWを使用している場合

```bash
# 1. UFWの状態を確認
sudo ufw status

# 2. UFWが無効化されている場合、有効化（重要：先にSSHポートを開放）
sudo ufw allow 22/tcp  # SSHポートを先に開放
sudo ufw enable

# 3. APIサーバーのポートを開放
sudo ufw allow 8888/tcp

# 4. 設定を確認
sudo ufw status verbose

# 5. 設定を再読み込み（UFWが有効化されている場合のみ）
sudo ufw reload
```

**注意**: `Firewall not enabled (skipping reload)`というメッセージが表示される場合は、UFWが無効化されています。上記の手順で`sudo ufw enable`を実行してからポートを開放してください。

### iptablesを使用している場合

```bash
sudo iptables -A INPUT -p tcp --dport 8888 -j ACCEPT
```

### クラウドプロバイダーのファイアウォールを使用している場合

Hostingerなどのクラウドプロバイダーを使用している場合、コントロールパネルからファイアウォール設定を行う必要がある場合があります。

## 11. Nginxリバースプロキシの設定（n8n + Express APIサーバー）

Ubuntu 24でn8nとExpress APIサーバー（zoom-clone-api）をnginxで動かす手順です。

### 前提条件

- n8nがDockerで動作している（ポート5678でアクセス可能）
- Express APIサーバーが動作している（ポート8888でアクセス可能）
- Traefikなどの他のリバースプロキシが停止している

### ステップ1: 現在の状態を確認

```bash
# n8nがポート5678で動作しているか確認
curl http://localhost:5678
sudo netstat -tulpn | grep 5678

# Express APIサーバーがポート8888で動作しているか確認
curl http://localhost:8888
sudo netstat -tulpn | grep 8888

# Traefikなど他のリバースプロキシが停止しているか確認
sudo docker ps | grep traefik
sudo netstat -tulpn | grep -E ':80|:443'
```

### ステップ2: Nginxのインストール

```bash
sudo apt-get update
sudo apt-get install nginx
```

### ステップ3: n8nとExpress APIサーバーを統合したNginx設定を作成

設定方法は2つあります：

#### 方法A: サブドメインで分ける（推奨）

```bash
sudo nano /etc/nginx/sites-available/multi-app
```

以下の内容を設定（`your-domain.com`を実際のドメインに置き換えてください）：

```nginx
# n8nのリバースプロキシ設定
server {
    listen 80;
    server_name n8n.your-domain.com;  # n8n用のサブドメイン

    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket対応（n8n用）
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}

# Express APIサーバー（zoom-clone-api）のリバースプロキシ設定
server {
    listen 80;
    server_name api.your-domain.com;  # API用のサブドメイン
    # または、同じドメインで使う場合: server_name your-domain.com;

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
        proxy_read_timeout 86400;
    }
}
```

#### 方法B: 同じドメインでパスベースで分ける

```bash
sudo nano /etc/nginx/sites-available/multi-app
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # n8n用のパス
    location /n8n/ {
        proxy_pass http://localhost:5678/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        
        # n8nのベースパスを設定（必要に応じて）
        rewrite ^/n8n/(.*)$ /$1 break;
    }

    # Express APIサーバー用のパス（ルート）
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
        proxy_read_timeout 86400;
    }
}
```

### ステップ4: Nginx設定を有効化

```bash
# デフォルトの設定を無効化（必要に応じて）
sudo rm /etc/nginx/sites-enabled/default

# カスタム設定を有効化
sudo ln -s /etc/nginx/sites-available/multi-app /etc/nginx/sites-enabled/multi-app

# 構文チェック（重要！）
sudo nginx -t
```

### ステップ5: Traefikを停止（使用している場合）

```bash
# Traefikコンテナを停止
sudo docker stop traefik

# または、docker-composeを使用している場合
cd /path/to/docker-compose/directory
sudo docker compose stop traefik
# または
sudo docker-compose stop traefik
```

### ステップ6: Nginxを起動

```bash
# Nginxを起動
sudo systemctl start nginx

# 自動起動を有効化
sudo systemctl enable nginx

# 状態を確認
sudo systemctl status nginx
```

### ステップ7: 動作確認

```bash
# n8nがアクセス可能か確認
curl http://localhost:5678
# または、サブドメインで設定した場合
curl http://n8n.your-domain.com

# Express APIサーバーがアクセス可能か確認
curl http://localhost:8888
# または、サブドメインで設定した場合
curl http://api.your-domain.com

# Nginxが正常にプロキシしているか確認
curl -H "Host: n8n.your-domain.com" http://localhost
curl -H "Host: api.your-domain.com" http://localhost
```

### トラブルシューティング

```bash
# Nginxのログを確認
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# ポートの使用状況を確認
sudo netstat -tulpn | grep -E ':80|:443|:5678|:8888'

# Nginx設定を再読み込み
sudo nginx -t
sudo systemctl reload nginx
```

### 次のステップ: SSL証明書の設定

両方のサービスにSSL証明書を設定する場合：

```bash
# Certbotをインストール
sudo apt-get install certbot python3-certbot-nginx

# サブドメインで分けている場合、両方に証明書を設定
sudo certbot --nginx -d n8n.your-domain.com
sudo certbot --nginx -d api.your-domain.com

# または、同じドメインでパスベースの場合
sudo certbot --nginx -d your-domain.com
```

---

## 11-1. Nginxリバースプロキシの設定（Express APIサーバーのみ）

ポート80/443でAPIのみを公開したい場合、Nginxをリバースプロキシとして設定できます。

### Nginxのインストール

```bash
sudo apt-get update
sudo apt-get install nginx
```

### Nginx設定ファイルの作成（Express APIサーバーのみ）

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
# デフォルトの設定を無効化（必要に応じて）
sudo rm /etc/nginx/sites-enabled/default

# カスタム設定を有効化
sudo ln -s /etc/nginx/sites-available/zoom-clone-api /etc/nginx/sites-enabled/

# 設定ファイルの構文チェック（重要：エラーがあれば修正）
sudo nginx -t

# 構文チェックが成功したら、nginxを起動またはリロード
sudo systemctl start nginx
# または既に起動している場合
sudo systemctl reload nginx

# 自動起動を有効化
sudo systemctl enable nginx

# 状態を確認
sudo systemctl status nginx
```

## 12. SSL証明書の設定（Let's Encrypt、オプション推奨）

### 基本的な設定（Nginx使用）

```bash
# CertbotとNginxプラグインをインストール
sudo apt-get install certbot python3-certbot-nginx

# ドメインのSSL証明書を取得（Nginxが自動設定されます）
sudo certbot --nginx -d your-domain.com

# 複数のドメインを指定する場合
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### ポート指定について

**重要**: Let's Encryptの検証は標準ポート（80番と443番）を使用します。そのため、通常は以下の条件が必要です：

- **ポート80**: HTTP検証（HTTP-01チャレンジ）用
- **ポート443**: HTTPS用（証明書取得後）

#### Standaloneモードでポート指定（Nginxが停止している場合）

Nginxプラグインを使用できない場合、standaloneモードでポートを指定できます：

```bash
# HTTP-01チャレンジ用のポートを指定（デフォルト: 80）
sudo certbot certonly --standalone --http-01-port 8080 -d your-domain.com

# TLS-ALPN-01チャレンジ用のポートを指定（デフォルト: 443）
sudo certbot certonly --standalone --tls-alpn-01-port 8443 -d your-domain.com
```

**注意**: カスタムポートを使用する場合、Let's Encryptの検証サーバーは標準ポート（80、443）でアクセスするため、以下のいずれかが必要です：

1. **ポートフォワーディング**: ファイアウォールで標準ポートからカスタムポートへ転送
2. **標準ポートでNginxを起動**: 証明書取得後、Nginxを標準ポートで起動

#### 推奨される方法

```bash
# 1. Nginxが標準ポート（80、443）で動作していることを確認
sudo systemctl status nginx
sudo netstat -tulpn | grep -E ':80|:443'

# 2. Nginxプラグインを使用して証明書を取得（最も簡単）
sudo certbot --nginx -d your-domain.com

# 3. 証明書の自動更新を確認
sudo certbot renew --dry-run
```

### 証明書の更新

```bash
# 手動で更新
sudo certbot renew

# 更新テスト（実際には更新されません）
sudo certbot renew --dry-run

# 自動更新はsystemdのタイマーで設定されます
sudo systemctl status certbot.timer
```

### 証明書の確認

```bash
# 証明書の情報を表示
sudo certbot certificates

# 証明書の有効期限を確認
sudo certbot certificates | grep -E "Certificate Name|Expiry Date"
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

### Nginxが起動しない場合

#### `Job for nginx.service failed because the control process exited with error code`

このエラーは、nginxの設定ファイルに問題があるか、ポートが既に使用されている場合に発生します。

**解決方法**:

1. **エラーの詳細を確認**:
   ```bash
   # サービスの状態を確認
   sudo systemctl status nginx.service
   
   # 詳細なログを確認
   sudo journalctl -xeu nginx.service
   ```

2. **設定ファイルの構文チェック**:
   ```bash
   # 設定ファイルの構文をチェック
   sudo nginx -t
   ```
   
   構文エラーがある場合、エラーメッセージに問題のファイルと行番号が表示されます。

3. **よくある原因と解決方法**:

   **a) 設定ファイルの構文エラー**:
   ```bash
   # エラーが表示されたファイルを編集
   sudo nano /etc/nginx/sites-available/zoom-clone-api
   
   # 構文チェックを再実行
   sudo nginx -t
   ```

   **b) ポート80が既に使用されている**:
   ```bash
   # ポート80を使用しているプロセスを確認
   sudo netstat -tulpn | grep :80
   # または
   sudo ss -tulpn | grep :80
   
   # 他のプロセスが使用している場合、停止するか、nginxの設定で別のポートを使用
   ```

   **n8nとnginxのポート競合を解決する場合**:
   
   まず、ポートの使用状況を確認：
   ```bash
   # ポート80と443を使用しているプロセスを確認
   sudo netstat -tulpn | grep -E ':80|:443'
   # または
   sudo ss -tulpn | grep -E ':80|:443'
   
   # n8nのプロセスを確認（PM2を使用している場合）
   pm2 list
   
   # n8nがDockerで動いている場合
   sudo docker ps
   ```
   
   n8nが既にポート80を使用している場合、以下の方法で解決できます：
   
   **方法1: Traefikを停止してnginxを使用（Docker + Traefikの場合）**:
   
   n8nがDockerとTraefikで動いている場合の移行手順：
   
   ```bash
   # 1. 現在のDockerコンテナの状態を確認
   sudo docker ps
   sudo docker ps -a | grep traefik
   sudo docker ps -a | grep n8n
   
   # 2. Traefikの設定とネットワークを確認
   sudo docker inspect traefik | grep -A 10 "Networks"
   sudo docker network ls
   
   # 3. n8nのコンテナ情報を確認（ポート5678が公開されているか）
   sudo docker inspect n8n | grep -i port
   # または
   sudo docker port n8n
   
   # 4. Traefikコンテナを停止
   sudo docker stop traefik
   # または、docker-composeを使用している場合
   cd /path/to/docker-compose/directory
   sudo docker-compose stop traefik
   
   # 5. Traefikの自動起動を無効化（docker-compose.ymlからtraefikサービスをコメントアウト）
   # または、システムdサービスを停止
   sudo systemctl stop traefik 2>/dev/null || true
   sudo systemctl disable traefik 2>/dev/null || true
   
   # 6. n8nが直接ポート5678でアクセス可能か確認
   curl http://localhost:5678
   # または
   sudo netstat -tulpn | grep 5678
   
   # 7. n8nのDockerコンテナがTraefikネットワークに接続されている場合、
   #    ホストネットワークまたはポートマッピングでアクセス可能にする必要がある
   #    docker-compose.ymlを確認して、n8nのports設定を確認
   ```
   
   **n8nのDocker設定を確認・修正**:
   
   ```bash
   # docker-compose.ymlの場所を確認（通常はn8nのディレクトリ）
   # 例: ~/n8n/docker-compose.yml または /opt/n8n/docker-compose.yml
   
   # docker-compose.ymlを編集
   sudo nano /path/to/n8n/docker-compose.yml
   ```
   
   以下の設定を確認：
   ```yaml
   services:
     n8n:
       # Traefikのラベルを削除またはコメントアウト
       # labels:
       #   - "traefik.enable=true"
       #   - "traefik.http.routers.n8n.rule=Host(`n8n.your-domain.com`)"
       
       # ポートマッピングを追加（まだない場合）
       ports:
         - "5678:5678"
       
       # Traefikネットワークから削除（必要に応じて）
       # networks:
       #   - traefik
   
     # Traefikサービスをコメントアウトまたは削除
     # traefik:
     #   ...
   ```
   
   設定変更後：
   ```bash
   # n8nコンテナを再起動
   cd /path/to/n8n/docker-compose/directory
   sudo docker-compose up -d n8n
   
   # n8nが正常に動作しているか確認
   sudo docker logs n8n
   curl http://localhost:5678
   ```
   
   **方法1-2: 既存のリバースプロキシを停止（Caddy、その他の場合）**:
   
   ```bash
   # ポート80を使用しているプロセスを確認
   sudo lsof -i :80
   # または
   sudo fuser 80/tcp
   
   # リバースプロキシを停止（Caddyの場合）
   sudo systemctl stop caddy
   sudo systemctl disable caddy  # 自動起動を無効化
   
   # nginxを起動
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```
   
   **方法2: nginxを別のポートで起動（一時的）**:
   ```bash
   # nginx設定ファイルを編集
   sudo nano /etc/nginx/sites-available/zoom-clone-api
   
   # listen 80; を listen 8080; に変更（一時的）
   # その後、n8nと統合してから標準ポートに戻す
   ```
   
   **方法3: nginxでn8nとzoom-clone-apiを統合（推奨）**:
   
   同じnginxインスタンスで両方をリバースプロキシとして設定：
   ```bash
   # nginx設定ファイルを作成または編集
   sudo nano /etc/nginx/sites-available/multi-app
   ```
   
   **重要**: Traefikを停止した後、以下の設定を行います：
   
   以下のように設定：
   ```nginx
   # n8nのリバースプロキシ設定
   server {
       listen 80;
       server_name n8n.your-domain.com;  # n8n用のサブドメイン
       
       location / {
           proxy_pass http://localhost:5678;  # n8nのデフォルトポート
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   
   # zoom-clone-apiのリバースプロキシ設定
   server {
       listen 80;
       server_name api.your-domain.com;  # API用のサブドメイン
       
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
   
   または、同じドメインでパスベースで分ける場合：
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       # n8n用のパス
       location /n8n/ {
           proxy_pass http://localhost:5678/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
       
       # zoom-clone-api用のパス
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
       }
   }
   ```
   
   設定後：
   ```bash
   # 設定ファイルを有効化
   sudo ln -s /etc/nginx/sites-available/multi-app /etc/nginx/sites-enabled/multi-app
   
   # 構文チェック
   sudo nginx -t
   
   # 問題がなければnginxを起動
   sudo systemctl start nginx
   sudo systemctl enable nginx
   
   # 状態を確認
   sudo systemctl status nginx
   
   # n8nとzoom-clone-apiが正常に動作しているか確認
   curl http://localhost:5678  # n8n
   curl http://localhost:8888  # zoom-clone-api
   ```
   
   **Traefikからnginxへの完全な移行手順（まとめ）**:
   
   ```bash
   # 1. 現在の状態を確認
   sudo docker ps
   sudo netstat -tulpn | grep -E ':80|:443|:5678'
   
   # 2. Traefikを停止
   sudo docker stop traefik
   # または
   cd /path/to/docker-compose && sudo docker-compose stop traefik
   
   # 3. n8nのdocker-compose.ymlを確認・修正
   #    - Traefikのラベルを削除
   #    - ポート5678が公開されていることを確認
   cd /path/to/n8n && sudo docker-compose up -d n8n
   
   # 4. nginx設定ファイルを作成
   sudo nano /etc/nginx/sites-available/multi-app
   # （上記の設定例をコピー）
   
   # 5. nginx設定を有効化
   sudo ln -s /etc/nginx/sites-available/multi-app /etc/nginx/sites-enabled/multi-app
   sudo rm /etc/nginx/sites-enabled/default  # 必要に応じて
   
   # 6. nginxを起動
   sudo nginx -t
   sudo systemctl start nginx
   sudo systemctl enable nginx
   
   # 7. 動作確認
   curl http://your-domain.com  # zoom-clone-api
   curl http://n8n.your-domain.com  # n8n（サブドメインの場合）
   ```

   **c) デフォルトのnginx設定との競合**:
   ```bash
   # デフォルトの設定を無効化
   sudo rm /etc/nginx/sites-enabled/default
   
   # 設定を再読み込み
   sudo nginx -t
   sudo systemctl start nginx
   ```

   **d) 必要なディレクトリが存在しない**:
   ```bash
   # ログディレクトリを作成
   sudo mkdir -p /var/log/nginx
   sudo chown -R www-data:www-data /var/log/nginx
   ```

4. **設定ファイルを修正後、再起動**:
   ```bash
   # 構文チェック
   sudo nginx -t
   
   # 問題がなければ起動
   sudo systemctl start nginx
   
   # 自動起動を有効化
   sudo systemctl enable nginx
   
   # 状態を確認
   sudo systemctl status nginx
   ```

5. **デフォルト設定をリセットする場合**:
   ```bash
   # カスタム設定を一時的に無効化
   sudo rm /etc/nginx/sites-enabled/zoom-clone-api
   
   # デフォルト設定を有効化
   sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/
   
   # テスト
   sudo nginx -t
   sudo systemctl start nginx
   ```

## 13. Docker Composeの自動起動設定

VPS再起動時にdocker-composeでymlファイルを読み込んで自動起動させる設定です。

### 方法1: systemdサービスを作成（推奨）

#### ステップ1: systemdサービスファイルを作成

```bash
# n8n用のsystemdサービスファイルを作成
sudo nano /etc/systemd/system/n8n-docker.service
```

以下の内容を設定（`/path/to/n8n`を実際のdocker-compose.ymlがあるディレクトリに置き換えてください）：

```ini
[Unit]
Description=n8n Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/n8n
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0
User=root

[Install]
WantedBy=multi-user.target
```

**注意**: 
- `WorkingDirectory`をdocker-compose.ymlがあるディレクトリに設定
- `docker compose`（スペース区切り）を使用している場合: `/usr/bin/docker compose`
- `docker-compose`（ハイフン区切り）を使用している場合: `/usr/local/bin/docker-compose`
- どちらを使うか確認: `which docker-compose` または `which docker compose`

#### ステップ2: docker-compose.ymlのパスを指定する場合

docker-compose.ymlが特定のパスにある場合：

```bash
sudo nano /etc/systemd/system/n8n-docker.service
```

```ini
[Unit]
Description=n8n Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/docker compose -f /path/to/n8n/docker-compose.yml up -d
ExecStop=/usr/bin/docker compose -f /path/to/n8n/docker-compose.yml down
TimeoutStartSec=0
User=root

[Install]
WantedBy=multi-user.target
```

#### ステップ3: サービスを有効化

```bash
# systemdの設定を再読み込み
sudo systemctl daemon-reload

# サービスを有効化（自動起動を有効にする）
sudo systemctl enable n8n-docker.service

# サービスを起動（テスト）
sudo systemctl start n8n-docker.service

# 状態を確認
sudo systemctl status n8n-docker.service
```

#### ステップ4: 動作確認

```bash
# サービスが正常に起動したか確認
sudo systemctl status n8n-docker.service

# コンテナが起動しているか確認
docker ps

# ログを確認
sudo journalctl -u n8n-docker.service -f
```

### 方法2: docker-compose.ymlでrestartポリシーを設定

docker-compose.ymlに`restart: unless-stopped`または`restart: always`を追加：

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n
    restart: unless-stopped  # または restart: always
    ports:
      - "5678:5678"
    # ... その他の設定
```

ただし、この方法ではdocker-composeコマンド自体が自動実行されないため、**方法1（systemdサービス）の方が確実**です。

### 方法3: Dockerの再起動ポリシーを使用（簡易版）

```bash
# 既存のコンテナに再起動ポリシーを設定
docker update --restart unless-stopped <container_name>

# 例
docker update --restart unless-stopped n8n
```

ただし、この方法はdocker-composeで管理されているコンテナには適用されない場合があります。

### 複数のdocker-composeプロジェクトを自動起動する場合

複数のdocker-composeプロジェクト（例: n8nとtraefik）を自動起動する場合：

```bash
# 各プロジェクト用にsystemdサービスを作成
sudo nano /etc/systemd/system/n8n-docker.service
sudo nano /etc/systemd/system/traefik-docker.service

# すべてを有効化
sudo systemctl enable n8n-docker.service
sudo systemctl enable traefik-docker.service

# または、1つのサービスで複数のプロジェクトを管理
sudo nano /etc/systemd/system/all-docker-compose.service
```

複数プロジェクトを1つのサービスで管理する例：

```ini
[Unit]
Description=All Docker Compose Services
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c 'cd /path/to/n8n && docker compose up -d && cd /path/to/traefik && docker compose up -d'
ExecStop=/bin/bash -c 'cd /path/to/n8n && docker compose down && cd /path/to/traefik && docker compose down'
TimeoutStartSec=0
User=root

[Install]
WantedBy=multi-user.target
```

### トラブルシューティング

```bash
# サービスが起動しない場合、ログを確認
sudo journalctl -u n8n-docker.service -n 50

# サービスの状態を確認
sudo systemctl status n8n-docker.service

# 手動で実行してエラーを確認
cd /path/to/n8n
docker compose up -d

# systemdの設定を再読み込み
sudo systemctl daemon-reload

# サービスを再起動
sudo systemctl restart n8n-docker.service
```

### よくある問題と解決方法

1. **`docker compose`コマンドが見つからない**:
   ```bash
   # パスを確認
   which docker compose
   which docker-compose
   
   # サービスファイルのExecStartで正しいパスを指定
   # /usr/bin/docker compose または /usr/local/bin/docker-compose
   ```

2. **権限エラー**:
   ```bash
   # サービスファイルでUserを確認
   # rootユーザーで実行するか、dockerグループにユーザーを追加
   sudo usermod -aG docker $USER
   ```

3. **Dockerサービスが起動する前に実行される**:
   ```bash
   # サービスファイルに以下を追加
   Requires=docker.service
   After=docker.service
   ```

### 確認方法

```bash
# 1. サービスが有効化されているか確認
sudo systemctl is-enabled n8n-docker.service

# 2. 再起動してテスト
sudo reboot

# 3. 再起動後、コンテナが起動しているか確認
docker ps

# 4. サービスログを確認
sudo journalctl -u n8n-docker.service
```

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

