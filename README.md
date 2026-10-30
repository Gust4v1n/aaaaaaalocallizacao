# Geo App 📍

Aplicativo de geolocalização desenvolvido com **React + Vite** e empacotado para Android nativo com **Capacitor 8**.

## 📱 Gerar APK no GitHub Actions

O repositório está configurado com um fluxo de CI/CD automatizado via GitHub Actions ([`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml)).

### Como baixar o APK gerado:
1. Acesse a aba **[Actions](https://github.com/Gust4v1n/aaaaaaalocallizacao/actions)** no repositório.
2. Clique na execução mais recente do workflow **Build Android APK**.
3. Na seção inferior da página em **Artifacts**, baixe o arquivo **`geo-app-debug-apk`**.
4. Descompacte o arquivo e instale o `geo-app-debug.apk` diretamente no seu dispositivo Android.

### Como disparar o build manualmente:
1. Vá até a aba **Actions**.
2. Selecione o workflow **Build Android APK** no menu lateral esquerdo.
3. Clique no botão **Run workflow** e selecione a branch `main`.

---

## 🛠️ Tecnologias
- [React 19](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Capacitor 8](https://capacitorjs.com/)
- [@capacitor/geolocation](https://capacitorjs.com/docs/apis/geolocation)
- GitHub Actions (Ubuntu Runner, JDK 21, Android SDK 36)

---

## 🚀 Como rodar localmente

### Pré-requisitos
- Node.js 20+
- Java JDK 17 ou 21
- Android Studio / Android SDK

### Passos:
```bash
# 1. Instalar dependências
npm install

# 2. Executar o servidor de desenvolvimento web
npm run dev

# 3. Gerar o build web e sincronizar com o Android
npm run build
npx cap sync android

# 4. Abrir no Android Studio
npx cap open android
```
