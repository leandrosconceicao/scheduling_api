import express from "express";
import cors from "cors";
import { errorCatcher, pageNotFound } from '@application';
import { router } from '@routes';

// Monta a aplicação sem efeitos colaterais (conexões, listen), permitindo reutilizá-la nos testes
export function createApp() {
    const app = express();

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
