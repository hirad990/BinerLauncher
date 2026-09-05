# Biner Launcher

لانچر رسمی BinerCraft برای Minecraft.

## وضعیت فعلی

- Electron desktop application واقعی
- پروفایل Local/Offline واقعی و ذخیره‌شده روی سیستم
- دانلود و اجرای واقعی نسخه‌های Vanilla با `minecraft-launcher-core`
- انتخاب نسخه و حافظه RAM
- اجرای مستقیم روی سرور BinerCraft
- آماده ساخت Installer ویندوز با NSIS

## اجرا

```bash
npm install
npm start
```

## ساخت Installer ویندوز

```bash
npm run dist
```

فایل نصب در پوشه `dist/` ساخته می‌شود.

## حساب محلی

نسخه فعلی عمداً Local است و هیچ رمز Microsoft درخواست یا ذخیره نمی‌کند. نام انتخاب‌شده به عنوان پروفایل آفلاین Minecraft استفاده می‌شود.

## Java

لانچر `JAVA_HOME`، مسیرهای رایج JDK 21/17 در ویندوز و در نهایت `java`/`java.exe` موجود در PATH را بررسی می‌کند.

## محل فایل‌های Minecraft

فایل‌های Minecraft در پوشه `minecraft` داخل مسیر user-data خود Electron ذخیره می‌شوند و کنار سورس لانچر قرار نمی‌گیرند.

## Roadmap

- Java Runtime Manager داخلی
- نمایش Progress دانلود
- Microsoft/Xbox authentication واقعی
- تشخیص و Repair نسخه‌های نصب‌شده
- پروفایل‌های Fabric / Forge / NeoForge
- اتصال News و API باینرکرفت
- Auto updater
- Portable build
