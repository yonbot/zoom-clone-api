# GitHubリポジトリへの発行手順

このプロジェクトを `https://github.com/yonbot/zoom-clone-api` に発行する手順です。

## 1. GitHubでリポジトリを作成（まだ作成していない場合）

1. GitHubにログイン: https://github.com
2. 右上の「+」ボタンをクリック → 「New repository」を選択
3. リポジトリ名を `zoom-clone-api` に設定
4. 説明（任意）を入力
5. **Public** または **Private** を選択
6. **「Initialize this repository with」のチェックを外す**（既存のコードがあるため）
7. 「Create repository」をクリック

## 2. ローカルでリモートリポジトリを確認

既にリモートは設定済みです。確認するには：

```bash
git remote -v
```

以下のように表示されるはずです：
```
origin  https://github.com/kurushiba/zoom-clone-api.git (fetch)
origin  https://github.com/kurushiba/zoom-clone-api.git (push)
yonbot  https://github.com/yonbot/zoom-clone-api.git (fetch)
yonbot  https://github.com/yonbot/zoom-clone-api.git (push)
```

## 3. 変更をコミット（必要に応じて）

```bash
# 変更を確認
git status

# 変更をステージング
git add .

# コミット（必要に応じて）
git commit -m "Add deployment configuration and setup files"
```

## 4. yonbotリポジトリにプッシュ

```bash
# masterブランチをプッシュ
git push yonbot master

# または、mainブランチを使用している場合
git push yonbot main
```

もし、リモートリポジトリが空の場合、初回プッシュ時は以下のコマンドを使用してください：

```bash
git push -u yonbot master
```

## 5. 確認

GitHubのリポジトリページ（https://github.com/yonbot/zoom-clone-api）を開いて、ファイルが正しくアップロードされているか確認してください。

## トラブルシューティング

### リポジトリが存在しない場合

エラー: `remote: Repository not found.`

解決策: GitHubでリポジトリを作成してください（手順1を参照）

### 認証エラーが発生する場合

エラー: `remote: Invalid username or password.`

解決策:
1. Personal Access Tokenを使用する場合:
   ```bash
   git remote set-url yonbot https://YOUR_TOKEN@github.com/yonbot/zoom-clone-api.git
   ```

2. SSHを使用する場合:
   ```bash
   git remote set-url yonbot git@github.com:yonbot/zoom-clone-api.git
   ```

### リモートが既に存在する場合

エラー: `remote yonbot already exists.`

解決策:
```bash
# 既存のリモートを削除
git remote remove yonbot

# 再度追加
git remote add yonbot https://github.com/yonbot/zoom-clone-api.git
```

