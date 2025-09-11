import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ⚠️ 핵심: base를 /admin/ 으로!
export default defineConfig({
  base: "/admin/",
  plugins: [react()],
  build: {
    outDir: "../public/admin", // 루트 프로젝트의 public/admin 으로 출력
    emptyOutDir: true,
    assetsDir: "assets",
  },
});
