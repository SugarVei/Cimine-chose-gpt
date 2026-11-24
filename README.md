# Cimine chose-gpt

[打开影院选座体验](https://works.sugarv.mom/cimine-chose-gpt/)

一个适配手机和桌面的实时 3D 影院选座网页。拖动蓝色连座，点击 **Preview** 飞入影厅。点迷你座位图上的蓝色座号可切换观影视角，左右滑动可环顾，点 **Seats** 返回。购票按钮生成演示票。

## 本地运行

下载并用支持 WebGL 2 的浏览器打开 `index.html` 即可离线体验。座位、织物、灯光和银幕画面均由代码生成。

## 从源码构建

安装 Node.js 后运行以下命令，重新生成独立的 `index.html`。

```sh
npm ci
npm run build
```

界面和拖放逻辑位于 `src/`。Three.js 影厅由 `src/theater.js` 创建，银幕纹理由 `src/screen.js` 绘制。
