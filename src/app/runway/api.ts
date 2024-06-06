import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  BaseClient,
  ControllerPool,
  ProxyService,
  Service,
  ChatModel,
  ChatProvider,
  PROXY_API_KEY,
  nanoid,
} from './base-client';
import _ from 'lodash';
import { Buffer } from 'node:buffer';
import { CookieJar } from 'tough-cookie';
import UserAgent from 'user-agents';
import { wrapper } from 'axios-cookiejar-support';
import { Mutex } from 'async-mutex';
import { urlAsX } from '../../common/utils/utils';

interface RunwayUploadResponse {
  id: string;
  uploadUrls: string[];
  uploadHeaders: Record<string, string>;
}

interface RunwayVideoType {
  id: string;
  user: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  parentAssetGroupId: string;
  filename: string;
  url: string;
  fileSize: number;
  isDirectory: boolean;
  private: boolean;
  privateInTeam: boolean;
  deleted: boolean;
  reported: boolean;
  frameRate: number;
  duration: number;
  favorite: boolean;
  width: number;
  height: number;
  content: Buffer;
  provider: ChatProvider;
  model: ChatModel;
  apiKey: string;
  proxy: string;
  remainingCredits: number;
}

export interface RunwayReqReturn {
  apiKey: string;
  taskIds: string[];
}

export class RunwayClient extends BaseClient {
  private static BASE_URL: string = 'https://api.runwayml.com/';
  private readonly client: AxiosInstance;
  private readonly Bearer: string;
  private semaphore: Semaphore;
  private queue: Array<() => Promise<any>> = [];

  constructor(
    private readonly apiKey: Service,
    private readonly proxyServices: ProxyService[],
  ) {
    super();

    const cookieJar = new CookieJar();
    const randomUserAgent = new UserAgent(/Chrome/).random().toString();
    this.Bearer = apiKey.apiKey!;
    this.client = wrapper(
      axios.create({
        jar: cookieJar,
        withCredentials: true,
        headers: {
          'User-Agent': randomUserAgent,
          Authorization: `Bearer ${this.Bearer}`,
        },
      }),
    );

    this.semaphore = new Semaphore(1);
  }

  private async processQueue() {
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
      }
    }
  }

  getRandomVersion() {
    return Math.floor(Math.random() * 100) + 1;
  }

  getRandomBrand() {
    const brands = ['Chromium', 'Google Chrome', 'Not-A.Brand'];
    return brands[Math.floor(Math.random() * brands.length)];
  }

  private reqConfig(
    apiKey: string,
    id?: string,
    useProxy?: boolean,
  ): AxiosRequestConfig {
    const headers = useProxy
      ? {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          Origin: 'https://app.runwayml.com',
          Referer: 'https://app.runwayml.com/',
          'Sec-Ch-Ua': `"${this.getRandomBrand()}";v="${this.getRandomVersion()}", "${this.getRandomBrand()}";v="${this.getRandomVersion()}", "Not-A.Brand";v="${this.getRandomVersion()}"`,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'X-Proxy-Api-Key': PROXY_API_KEY,
          'X-Target-Host': 'api.runwayml.com',
          'Sec-Fetch-Site': 'same-site',
          'Sentry-Trace': '555124acd49d49909707a4bcb9faccd3-aa18517b9717e519-0',
          'x-trace-id': id ?? nanoid(16),
          'x-start-at': Date.now(),
        }
      : {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          Origin: 'https://app.runwayml.com',
          Referer: 'https://app.runwayml.com/',
          'Sec-Ch-Ua': `"${this.getRandomBrand()}";v="${this.getRandomVersion()}", "${this.getRandomBrand()}";v="${this.getRandomVersion()}", "Not-A.Brand";v="${this.getRandomVersion()}"`,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'Sentry-Trace': '555124acd49d49909707a4bcb9faccd3-aa18517b9717e519-0',
        };

    const controller = new AbortController();
    return {
      timeout: 60000,
      headers,
      signal: controller.signal,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    };
  }

  async init(): Promise<RunwayClient> {
    return this;
  }

  calcService(model: ChatModel = ChatModel.RunwayGen2) {
    let proxyServer = RunwayClient.BASE_URL;
    let proxyService: ProxyService | undefined;
    if (this.proxyServices.length > 0) {
      proxyService = _.sample(this.proxyServices);
      proxyServer = proxyService!.server;
    }
    return [, proxyService, proxyServer] as const;
  }

  async getRunwayUserId(id?: string) {
    const [, proxyService, proxyServer] = this.calcService();
    const config = this.reqConfig('', id, !!proxyService);
    config.headers = {
      ...config.headers,
      'Content-Type': 'application/json',
    };

    try {
      const path = '/v1/profile';
      const response = await this.client.get(`${proxyServer}${path}`, config);
      if (response.status !== 200) {
        throw new Error(`Failed to get Runway user id: ${response.status}`);
      }
      const userId = response.data.user.id;
      return userId;
    } catch (error) {
      throw new Error(`Failed to get Runway user id: ${error}`);
    }
  }

  async getRunwayCredits(id?: string) {
    const [, proxyService, proxyServer] = this.calcService();
    const config = this.reqConfig('', id, !!proxyService);
    config.headers = {
      ...config.headers,
      'Content-Type': 'application/json',
    };

    try {
      const path = '/v1/profile';
      const response = await this.client.get(`${proxyServer}${path}`, config);
      if (response.status !== 200) {
        throw new Error(`Failed to get Runway user id: ${response.status}`);
      }
      return response.data.user.gpuCredits;
    } catch (error) {
      throw new Error(`Failed to get Runway user id: ${error}`);
    }
  }

  async generateVideo(
    prompt?: string,
    imagePrompt?: string,
    width?: number,
    height?: number,
    x?: number,
    y?: number,
    z?: number,
    r?: number,
    bg_x_pan?: number,
    bg_y_pan?: number,
    style?: string,
    upscale?: boolean,
    interpolate?: boolean,
    seed?: number,
    motion?: number,
    id?: string,
  ): Promise<RunwayReqReturn> {
    const runwayTaskIdsPromise = new Promise<string[]>((resolve, reject) => {
      const task = async () => {
        const [, proxyService, proxyServer] = this.calcService();
        const config = this.reqConfig('', id, !!proxyService);
        config.headers = {
          ...config.headers,
          'Content-Type': 'application/json',
        };
        try {
          const userId = await this.getRunwayUserId(id);
          if (!userId) {
            throw new Error('Failed to get Runway user id');
          }
          let name;
          if (!imagePrompt) {
            name = `Gen-2 ${seed}, ${prompt}, M ${motion}`;
          } else {
            name = `Gen-2 ${seed}, ${prompt}, IMG-${nanoid(4, true)}, M ${motion}`;
          }

          const payload = {
            taskType: 'gen2',
            internal: false,
            options: {
              name: name,
              seconds: 4,
              gen2Options: {
                mode: 'gen2',
                seed: seed,
                interpolate: interpolate,
                upscale: upscale,
                watermark: false,
                motion_score: 0,
                use_motion_score: false,
                use_motion_vectors: false,
                motion_vector: {},
              } as any,
              exploreMode: true,
              assetGroupName: 'Gen-2',
            },
            asTeamId: userId,
          };

          if (imagePrompt) {
            const url = await this.uploadImgReturnUrl(imagePrompt);
            payload.options.gen2Options.image_prompt = url;
            payload.options.gen2Options.init_image = url;
          }

          if (prompt) {
            payload.options.gen2Options.text_prompt = prompt;
          }

          if (prompt && !imagePrompt) {
            payload.options.gen2Options.width = width;
            payload.options.gen2Options.height = height;
          }

          if (x && y && z && r && bg_x_pan && bg_y_pan) {
            payload.options.gen2Options.use_motion_vectors = true;
            payload.options.gen2Options.motion_vector.x = -x;
            payload.options.gen2Options.motion_vector.y = y;
            payload.options.gen2Options.motion_vector.z = z;
            payload.options.gen2Options.motion_vector.r = r;
            payload.options.gen2Options.motion_vector.bg_x_pan = bg_x_pan;
            payload.options.gen2Options.motion_vector.bg_y_pan = bg_y_pan;
          } else {
            payload.options.gen2Options.use_motion_score = true;
            payload.options.gen2Options.motion_score = 22;
          }

          if (!imagePrompt && style) {
            payload.options.gen2Options.style = style;
          }

          const path = '/v1/tasks';
          const response = await this.client.post(
            `${proxyServer}${path}`,
            payload,
            config,
          );
          const runwayTask = response.data;
          let taskId = '';
          if (runwayTask && runwayTask.task && runwayTask.task.id) {
            taskId = runwayTask.task.id;
          } else {
            throw new Error('send runway gen failed');
          }
          resolve([taskId, userId]);
        } catch (err) {
          reject(new Error(`Failed to generate video. Error: ${err}`));
        } finally {
          // 释放信号量
          this.semaphore.release();
          // 处理队列中的下一个任务
          this.processQueue();
        }
      };

      // 将任务添加到队列
      this.queue.push(() => this.semaphore.acquire().then(task));
      // 如果队列中只有一个任务，立即处理
      if (this.queue.length === 1) {
        this.processQueue();
      }
    });
    const runwayTaskIds = await runwayTaskIdsPromise;
    const runwayRes = {
      apiKey: this.apiKey.apiKey!,
      taskIds: runwayTaskIds,
    };
    return runwayRes;
  }

  async getVideoByTaskId(
    taskIds: string[],
    id?: string,
  ): Promise<RunwayVideoType | undefined> {
    const [, proxyService, proxyServer] = this.calcService();
    const config = this.reqConfig('', id, !!proxyService);
    config.headers = {
      ...config.headers,
      'Content-Type': 'application/json',
    };

    try {
      const taskId = taskIds[0];
      const teamId = taskIds[1];
      const path = `/v1/tasks/${taskId}?asTeamId=${teamId}`;
      const response = await this.client.get(`${proxyServer}${path}`, config);
      if (response.data?.error === 'Permission denied.') {
        // 权限错误，不是同一个key
        throw new Error('This cookie permission denied.');
      }
      if (response.data?.task?.status === 'FAILED') {
        throw new Error(
          'Task proecss FAILED:',
          response.data.task.progressText,
        );
      }
      if (response.data?.task?.status !== 'SUCCEEDED') {
        // 未完成，重新添加异步任务
        return;
      }
      const taskRes = response.data.task;
      const taskArtifacts = taskRes.artifacts;
      const [audioData, contentType] = await StringUtil.urlAsX(
        taskArtifacts[0]?.url as string,
        'arraybuffer',
      );
      const buff = Buffer.from(audioData, 'base64');
      return {
        id: taskArtifacts[0].taskId,
        user: taskArtifacts[0].userId,
        createdBy: taskArtifacts[0].createdBy,
        createdAt: taskArtifacts[0].createdAt,
        updatedAt: taskArtifacts[0].updatedAt,
        parentAssetGroupId: taskArtifacts[0].parentAssetGroupId,
        filename: taskArtifacts[0].filename,
        url: taskArtifacts[0].url,
        fileSize: taskArtifacts[0].fileSize,
        isDirectory: taskArtifacts[0].isDirectory,
        private: taskArtifacts[0].private,
        privateInTeam: taskArtifacts[0].privateInTeam,
        deleted: taskArtifacts[0].deleted,
        reported: taskArtifacts[0].reported,
        frameRate: taskArtifacts[0].metadata.frameRate,
        duration: taskArtifacts[0].metadata.duration,
        favorite: taskArtifacts[0].favorite,
        width: taskArtifacts[0].metadata.size.width,
        height: taskArtifacts[0].metadata.size.height,

        content: buff,
        provider: ChatProvider.Runway,
        model: ChatModel.RunwayGen2,
        apiKey: this.apiKey.apiKey!,
        proxy: proxyServer,
        remainingCredits: await this.getRunwayCredits(),
      };
    } catch (error) {
      throw new Error(`Failed to fetch task. Error: ${error.data.error}`);
    }
  }

  async uploadImgReturnUrl(imgUrl: string, id?: string) {
    try {
      // 获取文件名
      const regex = /\/([^\/?]+)(\?.*)?$/;
      const match = imgUrl.match(regex);
      let fileName = '';
      if (match) {
        fileName = match[1];
      } else {
        throw new Error('ImagePrompt url is invalid');
      }

      // 第一步：发送POST请求获取上传 uploadUrl,和 fileId
      const uploadAPiPath = `/v1/uploads`;
      const uploadPayload = {
        filename: fileName,
        numberOfParts: 1,
        type: 'DATASET',
      };
      const [, proxyService, proxyServer] = this.calcService();
      let config = this.reqConfig(this.apiKey.apiKey!, id, !!proxyService);
      config.headers = {
        ...config.headers,
        'Content-Type': 'application/json',
      };

      const response = await this.client.post<RunwayUploadResponse>(
        `${proxyServer}${uploadAPiPath}`,
        uploadPayload,
        config,
      );
      const fileId = response.data.id;
      const uploadUrls = response.data.uploadUrls;
      const uploadHeaders = response.data.uploadHeaders;
      const uploadUrl = uploadUrls[0];

      // 第二步：根据上传 uploadUrl，获取到Etag
      const [fileStream, contentType] = await StringUtil.urlAsX(imgUrl);
      const contentLength = fileStream.headers['content-length'];
      const res = await axios.put(uploadUrl, fileStream, {
        headers: {
          ...uploadHeaders,
          'Content-Length': contentLength,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
      const ETag = res.headers.etag;
      // 第三步：获取图片地址
      const pathCompletePath = `/v1/uploads/${fileId}/complete`;
      const payloadComplete = {
        parts: [
          {
            PartNumber: 1,
            ETag: ETag,
          },
        ],
      };
      const resCompleted = await this.client.post(
        `${proxyServer}${pathCompletePath}`,
        payloadComplete,
        config,
      );
      return resCompleted.data.url;
    } catch (error) {
      throw new Error(`Error upload image: ${error.message}`);
    }
  }
}

export const newRunwayClient = async (
  apiKeys: Service[],
  proxies: ProxyService[],
  apiKey?: string,
) => {
  let keys = apiKeys.filter((e) => e.serviceModel === ChatModel.RunwayGen2);
  keys = keys.flatMap((k) => {
    return _.times(k.weight, () => k);
  });
  let key;
  if (apiKey) {
    // 根据apiKey 锁定到具体的 apiKey 服务
    key = keys.find((k) => k.apiKey === apiKey)!;
  } else {
    key = _.sample(keys)!;
  }
  const client = new RunwayClient(key, proxies);
  return await client.init();
};
