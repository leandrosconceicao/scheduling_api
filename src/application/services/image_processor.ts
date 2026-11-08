import sharp from "sharp";
import { ApiResponse } from "../dtos/api_response";

/**
 * Valida o conteúdo real do arquivo (o MIME enviado pelo cliente não é confiável),
 * corrige a rotação EXIF, limita as dimensões e converte para WebP sem metadados.
 */
export async function processImage(file: Buffer | undefined, maxDimension: number): Promise<Buffer> {
    if (!file?.length)
        throw ApiResponse.parameterInvalid("Arquivo é obrigatório");

    try {
        return await sharp(file, { limitInputPixels: 25_000_000 })
            .rotate()
            .resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
    } catch {
        throw ApiResponse.parameterInvalid("Arquivo enviado não é uma imagem válida");
    }
}
