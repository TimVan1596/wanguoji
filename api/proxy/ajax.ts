import axios, { AxiosProxyConfig } from "axios";
// 代理服务器
const proxyHost = process.env.HTTP_PROXY_HOST ?? "";
const proxyPort = Number(process.env.HTTP_PROXY_PORT ?? 0);

// 代理隧道验证信息
const proxyUser = process.env.HTTP_PROXY_USERNAME ?? "";
const proxyPass = process.env.HTTP_PROXY_PASSWORD ?? "";

var proxy: AxiosProxyConfig = {
  host: proxyHost,
  port: proxyPort,
  auth: {
    username: proxyUser,
    password: proxyPass,
  },
};

export const httpGet = (url: string) => {
  return axios.get(url, {
    // 未配置代理时，不使用代理
    proxy: proxyHost ? proxy : undefined,
  });
};
