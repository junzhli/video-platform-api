import mmmagic from "mmmagic";
import multer from "multer";
import logger from "../libs/logger";

const log = logger("multer-middleware");
const Magic = mmmagic.Magic;



const storageAvater = multer.diskStorage({});
// TODO move to another persistent storage
const storageTempClip = multer.diskStorage({ destination: "upload/videos/" });

export const ACCECPTED_PICTURE_TYPES = ["image/jpeg", "image/png"];
export const ACCECPTED_VIDEO_TYPES = ["video/mp4"];

const uploadAvatar = multer({ storage: storageAvater, fileFilter: (req, file, callback) => {
    if (!ACCECPTED_PICTURE_TYPES.includes(file.mimetype)) {
        log.warn("minetype is mismatch!");
        callback(null, false);
        return;
    }

    callback(null, true);
} });

const uploadTempClip = multer({ storage: storageTempClip, fileFilter: (req, file, callback) => {
    if (!ACCECPTED_VIDEO_TYPES.includes(file.mimetype)) {
        log.warn("minetype is mismatch!");
        callback(null, false);
        return;
    }

    callback(null, true);
} });

const magic = new Magic(mmmagic.MAGIC_MIME_TYPE);
const checkFileAuthenticity = async (file: Express.Multer.File, acceptedTypes: string[]) => {
    return new Promise((res, rej) => {
        magic.detectFile(file.path, (err, result) => {
            if (err) {
                log.warn("detect file failed");
                return rej(err);
            }
    
            if (Array.isArray(result)) {
                for (const r of result) {
                    if (!acceptedTypes.includes(r)) {
                        log.warn("detected file type mismatched with supported: " + r);
                        return res(false);
                    }
                }
            } else {
                if (!acceptedTypes.includes(result)) {
                    log.warn("detected file type mismatched with supported: " + result);
                    return res(false);
                }
            }
            
            res(true);
        });
    });
};

export {
    uploadTempClip,
    uploadAvatar,
    checkFileAuthenticity
};