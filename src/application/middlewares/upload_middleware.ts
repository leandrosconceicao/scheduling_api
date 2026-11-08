import multer from "multer";
import { ApiResponse } from "../dtos/api_response";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const MAX_IMAGE_SIZE_IN_BYTES = 2 * 1024 * 1024;

/** Recebe um único campo "file" em memória, limitado a 2 MB e a imagens JPEG, PNG ou WebP. */
export const uploadImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_SIZE_IN_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);

        cb(ApiResponse.parameterInvalid("Formato inválido, envie uma imagem JPEG, PNG ou WebP") as unknown as Error);
    }
}).single("file");
