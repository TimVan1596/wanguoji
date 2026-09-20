import axios from 'axios'
import CrypotJs from 'crypto-js'

const accessKeyId = process.env.BILIBILI_ACCESS_KEY_ID ?? ""
const accessKeySecred = process.env.BILIBILI_ACCESS_KEY_SECRET ?? ""
const app_id = Number(process.env.BILIBILI_APP_ID ?? 0)



const request = axios.create({
    baseURL: "https://live-open.biliapi.com",
    headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
    }
})

request.interceptors.request.use((config) => {
    const md5 = CrypotJs.MD5(JSON.stringify(config.data))
    const headerStr = `x-bili-accesskeyid:${accessKeyId}
x-bili-content-md5:${md5.toString()}
x-bili-signature-method:HMAC-SHA256
x-bili-signature-nonce:${CrypotJs.HmacSHA256(Math.random().toString(), 'random').toString()}
x-bili-signature-version:1.0
x-bili-timestamp:${Math.floor(new Date().getTime() / 1000)}`
    let headers: Record<string, string> = {}
    headerStr.split('\n').forEach(header => {
        const [key, value] = header.split(':')
        headers[key] = value
    })

    const sha256 = CrypotJs.HmacSHA256(headerStr,accessKeySecred)

    // @ts-ignore
    config.headers = {
        ...config.headers,
        ...headers,
        Authorization: sha256.toString()
    }
    return config
})

export default async function (code) {
    if (!accessKeyId || !accessKeySecred || !app_id) {
        throw new Error("Bilibili live-open credentials are not configured.")
    }
    const res = await request.post('/v2/app/start', {
        code,
        app_id
    })

    return res.data?.data
}
