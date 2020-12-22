import { IResponseErrorMessage } from "./error";
import { IResponseBodyUserInfo  } from "./userBasic";

interface IResponseBodyGeneralMessage {
    message: string;
}

interface IResponseBodyUserLike {
    like: boolean;
}

export {
    IResponseBodyUserInfo,
    IResponseErrorMessage,
    IResponseBodyGeneralMessage,
    IResponseBodyUserLike
};