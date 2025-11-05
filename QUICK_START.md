# GitHubリポジトリへの発行 - クイックスタート

## ステップ1: GitHubでリポジトリを作成

1. **GitHubにログイン**: https://github.com/yonbot
2. **リポジトリ作成ページを開く**: https://github.com/new
3. **リポジトリ情報を入力**:
   - **Repository name**: `zoom-clone-api`
   - **Description** (任意): `Zoom Clone API Server`
   - **Visibility**: Public または Private を選択
   - **⚠️ 重要**: 「Add a README file」「Add .gitignore」「Choose a license」のチェックは**すべて外す**（既存のコードがあるため）
4. **「Create repository」をクリック**

## ステップ2: ローカルからプッシュ

リポジトリを作成したら、以下のコマンドを実行してください：

```bash
git push -u yonbot master
```

これで、すべてのコードがGitHubにアップロードされます。

## 完了確認

https://github.com/yonbot/zoom-clone-api にアクセスして、ファイルが正しくアップロードされているか確認してください。

---

**注意**: 認証エラーが発生する場合は、Personal Access TokenまたはSSH鍵の設定が必要です。

