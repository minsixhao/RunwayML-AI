import axios, {
    AxiosRequestConfig,
    responseEncoding,
    ResponseType,
  } from 'axios';
  import { customAlphabet } from 'nanoid';
  
  const DEFAULT_TIMEOUT = 600000;
  export const nanoid = (size: number, numberOnly: boolean = false) =>
    customAlphabet(
      numberOnly
        ? '0123456789'
        : '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      size,
    )();
  
  export async function urlAsX(
    url: string,
    responseType: ResponseType = 'stream',
    responseEncoding?: responseEncoding,
  ) {
    const config: AxiosRequestConfig = {
      timeout: DEFAULT_TIMEOUT,
      responseType: responseType,
    };
    if (responseEncoding) {
      config.responseEncoding = responseEncoding;
    }
    const file = await axios.get(url, config);
    return [file.data, file.headers['content-type']] as const;
  }
  