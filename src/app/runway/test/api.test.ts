import { newSunoClient } from '../api';
import { Service } from '../base-client';
import { Time } from '../utils/time';

Time.init();
jest.setTimeout(JEST_TIMEOUT);
describe('RunwayApi', () => {
  let client = newRunwayClient(
    ENV.apiKeys.filter(
      (k) => k.serviceProvider === ChatProvider.Runway,
    ) as Service[],
    ENV.proxyServers.map((v, i) => ({ id: 's' + i, server: v })),
  );

  // 分解步骤
  it('step1: generate video', async () => {
    const prompt = '哥斯拉吃拉面';
    // const imagePrompt = 'url';

    const res = await (await client).generateVideo(prompt);
    console.log(res);
  });

  it('step2: get generate video', async () => {
    const taskId = '02091a05-15e2-46b9-97cf-a4cf0df1fe39';
    const teamId = '16213517';
    const isCompleted = await (
      await client
    ).getVideoByTaskId([taskId, teamId], 'idtest');
    console.log(isCompleted);
    if (isCompleted) {
      const res = await (
        await client
      ).getVideoByTaskId([taskId, teamId], 'idtest');
      console.log(res);
    }
  });

  it('getRunwayCredits', async () => {
    const res = await (await client).getRunwayCredits();
    console.log(res);
  });

  it('upload Image', async () => {
    const imgUrl =
      'https://oss-dev.tishi.top/sd/t/bKYva0DELhhSAh1S/uqxPTBIDzi1rdXR2/1717057087_1.png';
    const res = await (await client).uploadImgReturnUrl(imgUrl);
    console.log(res);
  });
});
