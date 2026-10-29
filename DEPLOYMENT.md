# 🚀 Guide de Déploiement — L'Conq

Ce guide détaille les différentes méthodes pour déployer l'application **L'Conq** (Vite + React + PWA) en production.

---

## 📋 Prérequis de Build

Avant de déployer, assurez-vous d'avoir Node.js (version 20 recommandée) installé pour tester le build de production localement :

```bash
# Installer les dépendances propres
npm ci

# Tester la compilation de production
npm run build
```

Les fichiers générés se trouveront dans le dossier `dist/` à la racine du projet.

---

## 🐳 Méthode 1 : Déploiement avec Docker (Recommandé pour VPS et Cloud)

Nous avons configuré un **Dockerfile** multi-étape et un fichier **nginx.conf** adapté pour gérer le routage SPA (Single Page Application) sans erreur 404 sur les routes dynamiques (`/study`, `/dashboard`, etc.).

### 1. Construire l'image Docker
```bash
docker build -t lconq-app .
```

### 2. Lancer le conteneur localement
```bash
docker run -d -p 8080:80 --name lconq-container lconq-app
```
L'application sera alors accessible sur `http://localhost:8080`.

---

## ☁️ Méthode 2 : Déploiement Cloud (Vercel, Netlify, Cloudflare Pages)

Ces plateformes de serveurs statiques (Serverless) conviennent parfaitement pour l'architecture SPA de L'Conq.

### Option A : Vercel (Recommandé - Ultra rapide)
1. Installez le CLI Vercel ou connectez votre dépôt GitHub sur [Vercel](https://vercel.com).
2. Configurez les paramètres suivants lors de l'importation :
   - **Framework Preset** : `Vite`
   - **Build Command** : `npm run build`
   - **Output Directory** : `dist`
3. Créez un fichier `vercel.json` à la racine si vous voulez forcer la redirection SPA (géré automatiquement par Vercel la plupart du temps) :
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

### Option B : Netlify
1. Connectez votre dépôt GitHub sur [Netlify](https://netlify.com).
2. Configurez les mêmes commandes de build (`npm run build`, dossier `dist`).
3. Pour éviter les erreurs 404 lors du rafraîchissement des pages, créez un fichier `_redirects` dans le dossier `public/` avec le contenu suivant :
   ```text
   /*    /index.html   200
   ```

---

## 🛠️ Méthode 3 : Déploiement sur un VPS classique (Nginx direct)

Si vous utilisez un serveur VPS Linux (Ubuntu/Debian) avec Nginx déjà installé :

1. Compilez le projet localement ou sur votre serveur d'intégration continue :
   ```bash
   npm run build
   ```
2. Transférez le contenu du dossier `dist/` vers votre dossier web sur le VPS (ex: `/var/www/lconq`).
3. Configurez votre bloc serveur Nginx (similaire à notre `nginx.conf`) :

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        root /var/www/lconq;
        index index.html index.htm;
        try_files $uri $uri/ /index.html; # Très important pour le routage React Router
    }

    # Cache des éléments statiques pour de superbes performances PWA
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf|json)$ {
        root /var/www/lconq;
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }
}
```

---

## 🟣 Méthode 4 : Déploiement Hostinger (hPanel / Node.js & Static)

### Option A : Hostinger Node.js Application (Recommandé - API & MySQL activés)
1. Rendez-vous dans le tableau de bord **Hostinger hPanel** > **Sites Web** > **Gérer** > **Node.js** (ou VPS).
2. Configurez les paramètres d'application :
   - **Version Node.js** : `20.x` ou `22.x`
   - **Répertoire de l'application (Application root)** : dossier de votre projet (ex: `public_html` ou sous-dossier)
   - **Fichier de démarrage (Startup file)** : `server.js`
   - **Mode d'application** : `production`
3. Variables d'environnement (dans le gestionnaire hPanel ou fichier `.env`) :
   ```env
   PORT=3000
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=u663560985_gamaco
   DB_USER=u663560985_gamaco_usr
   DB_PASSWORD=votre_mot_de_passe
   ADMIN_EMAIL=admin@lconq.ma
   ADMIN_PASSWORD=votre_mot_de_passe_admin
   GEMINI_API_KEY=votre_cle_gemini
   ```
4. Exécutez le build de production :
   ```bash
   npm ci
   npm run build
   ```
5. Cliquez sur **Redémarrer l'application** dans Hostinger hPanel.

### Option B : Déploiement Statique Rapide via hPanel (File Manager / FTP)
1. Le projet compile l'ensemble des fichiers optimisés dans `dist/` avec redirection Apache/LiteSpeed `.htaccess` déjà configurée.
2. Téléversez directement l'archive `dist-hostinger.zip` (ou le contenu de `dist/`) dans le dossier `public_html/` de votre domaine sur Hostinger.
3. Extrayez l'archive dans `public_html/`. Le fichier `.htaccess` gère automatiquement la réécriture des URLs pour React Router sans aucune configuration supplémentaire.

### Option C : Déploiement Git Hostinger (hPanel Git)
1. Dans hPanel > **Avancé** > **Git**.
2. Connectez le dépôt : `https://github.com/cheikhzay-collab/GAMACO.git` sur la branche `main`.
3. Cliquez sur **Déployer** (ou utilisez l'URL du webhook GitHub pour un redéploiement automatique à chaque push).

---

## 🔄 Intégration Continue (CI/CD)

Un workflow **GitHub Actions** a été ajouté dans le dossier [`.github/workflows/ci-cd.yml`](file:///.github/workflows/ci-cd.yml).
* À chaque **push** ou **pull request** sur la branche `main`, le code est automatiquement récupéré, les dépendances sont installées et le build est testé pour s'assurer qu'aucune régression ou erreur de compilation n'est poussée en production.
