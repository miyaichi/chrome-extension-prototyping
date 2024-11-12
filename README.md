# Chrome Extension Template

TypeScriptとReactを使用したChrome拡張機能のテンプレートプロジェクトです。

## 機能

- TypeScript + Reactによる開発環境
- Chrome Storage APIを使用した設定管理
- サイドパネルUI
- コンテンツスクリプト
- バックグラウンドスクリプト

## ディレクトリ構成

```
├── public/
│   └── sidepanel.html   # サイドパネルのHTML
├── src/
└── assets/
│   └── icons/
│   │   ├── source/      # アイコンのソースファイル
│   │   └── build/       # svgファイルから生成したアイコン
│   ├── background/      # バックグラウンドスクリプト
│   │   └── background.ts
│   ├── contentScript/   # コンテンツスクリプト
│   │   └── contentScript.ts
│   ├── sidepanel/　　　  # サイドパネルUI関連
│   │   ├── index.tsx
│   │   └── SidePanel.tsx
│   └── types/           # 型定義
│       └── index.ts
├── dist/                # ビルド出力（git管理外）
├── manifest.json        # 拡張機能マニフェスト
├── webpack.config.js    # Webpack設定
├── tsconfig.json        # TypeScript設定
├── package.json         # プロジェクト設定
└── README.md            # 本ファイル
```

## 必要要件

- Node.js (16.x以上)
- npm (8.x以上)

## インストール方法

1. リポジトリのクローン
```bash
git clone https://github.com/miyaichi/chrome-extension-prototyping.git
cd chrome-extension-prototyping
```

2. 依存パッケージのインストール
```bash
npm install
```

## ビルド方法

### 開発用ビルド（ウォッチモード）
```bash
npm run watch
```

### プロダクション用ビルド
```bash
npm run build
```

## Chrome拡張機能としての導入方法

1. Chromeブラウザで `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. プロジェクトの `dist` ディレクトリを選択

## 開発の始め方

1. `src/types/index.ts` で必要な型を定義
2. `src/sidepanel/SidePanel.tsx` でポップアップUIを実装
3. `src/background/background.ts` でバックグラウンド処理を実装
4. `src/contentScript/contentScript.ts` でページ内の処理を実装

## スクリプト

- `npm run build`: プロダクション用ビルドを実行
- `npm run watch`: 開発用のウォッチモードでビルドを実行

## 設定ファイルのカスタマイズ

### manifest.json

拡張機能の権限や動作設定を変更する場合は、`manifest.json`を編集します：

```json
{
   "permissions": ["activeTab", "scripting", "storage", "sidePanel"
    // 必要な権限を追加
  ],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      // 適用するURLパターンを調整
    }
  ]
}
```

### webpack.config.js

ビルド設定をカスタマイズする場合は、`webpack.config.js`を編集します。

## デバッグ方法

1. Chrome拡張機能の管理ページで拡張機能のIDを確認
2. バックグラウンドページのデバッグ：
   - `chrome://extensions` で「バックグラウンドページ」をクリック
3. ポップアップのデバッグ：
   - 拡張機能アイコンを右クリック→「検証」
4. コンテンツスクリプトのデバッグ：
   - ページ上で右クリック→「検証」
   - Consoleタブでコンテンツスクリプトのログを確認

## ライセンス

This project is licensed under the MIT License, see the LICENSE.txt file for details.

## 貢献について

1. このリポジトリをフォーク
2. 新しいブランチを作成 (`git checkout -b feature/awesome-feature`)
3. 変更をコミット (`git commit -am 'Add awesome feature'`)
4. ブランチをプッシュ (`git push origin feature/awesome-feature`)
5. プルリクエストを作成

