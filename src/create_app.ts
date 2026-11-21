import express from "express";
import cors from "cors";
import { errorCatcher, pageNotFound } from '@application';
import { router } from '@routes';

// Monta a aplicação sem efeitos colaterais (conexões, listen), permitindo reutilizá-la nos testes
export function createApp() {
    const app = express();

    // App Engine fica atrás de um proxy: sem isso req.ip seria o do proxy (quebra o limite de login por IP)
    app.set("trust proxy", 1);

    app.use(cors());

    app.use(
        express.json({
            limit: "10mb"
        })
    )

    router(app);

    app.use(pageNotFound);
    app.use(errorCatcher)

    return app;
}
