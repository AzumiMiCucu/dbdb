import { execSync } from "child_process";
import * as cheerio from "cheerio";

class Mi9Downloader {
    constructor(cookie = '') {
        this.userAgent = 'Mozilla/5.0 (Linux; Android 16; Infinix X6837 Build/BP2A.250605.031.A2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.137 Mobile Safari/537.36';
        this.cookie = cookie || 'PHPSESSID=vqr7roh6kgjc42fvfpkru6iqkd; _ga=GA1.1.518714447.1778043783';
    }

    _fetchStream(url) {
        const command = `curl -s -N --compressed ` +
            `-A "${this.userAgent}" ` +
            `-H "Accept: text/event-stream" ` +
            `-H "Accept-Language: en-ID,en;q=0.9,id-ID;q=0.8,id;q=0.7,en-US;q=0.6" ` +
            `-H "Referer: https://mi9.com/apk-downloader" ` +
            `-H "x-requested-with: com.xbrowser.play" ` +
            `-H "Cookie: ${this.cookie}" ` +
            `"${url}"`;

        try {
            return execSync(command, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 20 });
        } catch (error) {
            throw new Error(`Execution Error: ${error.message}`);
        }
    }

    search(packageName) {
        const payloadObj = {
            package: packageName,
            vc: "",
            device: "phone",
            arch: "arm64-v8a",
            device_id: "",
            sdk: "default",
            hl: "en",
            timestamp: Date.now()
        };

        const base64Data = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
        const apiUrl = `https://mi9.com/mi9apk?id_token=&data=${base64Data}`;

        const streamData = this._fetchStream(apiUrl);
        if (!streamData) return null;

        let extractedData = null;
        const lines = streamData.split('\n');

        for (const line of lines) {
            if (line.trim().startsWith('data:')) {
                const jsonStr = line.replace(/^data:\s*/, '').trim();
                if (!jsonStr) continue;

                try {
                    const parsedObj = JSON.parse(jsonStr);
                    if ((parsedObj.status === 'ready' || parsedObj.type === 'success') && parsedObj.html) {
                        const $ = cheerio.load(parsedObj.html);

                        const downloadLinks = [];
                        $('.apk_files_item a').each((i, el) => {
                            downloadLinks.push({
                                fileName: $(el).find('.der_name').text().trim(),
                                fileSize: $(el).find('.der_size').text().trim(),
                                url: $(el).attr('href').replace(/&amp;/g, '&')
                            });
                        });

                        const btnApk = $('#downloadButtonapk');
                        let compressParams = null;
                        
                        if (btnApk.length > 0) {
                            compressParams = {
                                h: btnApk.attr('data-h'),
                                token: btnApk.attr('data-token'),
                                ip: btnApk.attr('data-ip'),
                                google_id: btnApk.attr('data-google-id'),
                                t: btnApk.attr('data-expiration')
                            };
                        }

                        extractedData = {
                            appName: $('li._title a').text().trim(),
                            version: $('span._version').text().trim(),
                            updateDate: $('.apk_ad_info li').eq(2).text().replace('Update:', '').trim(),
                            whatsNew: $('.wne').text().replace('What’s new', '').trim(),
                            iconUrl: $('.apk_ad img').attr('src'),
                            filesCount: downloadLinks.length,
                            downloads: downloadLinks,
                            _compressParams: compressParams
                        };
                    }
                } catch (e) {
                }
            }
        }

        return extractedData;
    }
    getMergedApk(params) {
        if (!params || !params.h || !params.token) {
            throw new Error("Invalid compression parameters.");
        }

        const compressUrl = `https://mi9.com/compress/?h=${params.h}&p=apk&token=${params.token}&ip=${params.ip}&google_id=${params.google_id}&t=${params.t}`;
        
        const streamData = this._fetchStream(compressUrl);
        if (!streamData) return null;

        let finalDownloadUrl = null;
        const lines = streamData.split('\n');

        for (const line of lines) {
            if (line.trim().startsWith('data:')) {
                const jsonStr = line.replace(/^data:\s*/, '').trim();
                if (!jsonStr) continue;

                try {
                    const parsedObj = JSON.parse(jsonStr);
                    if (parsedObj.status === 'ready' && parsedObj.download_url) {
                        finalDownloadUrl = parsedObj.download_url;
                    }
                } catch (e) {
                 
                }
            }
        }

        return finalDownloadUrl;
    }
    getMergedZip(params) {
        if (!params || !params.h || !params.token) {
            throw new Error("Invalid compression parameters.");
        }

        const compressUrl = `https://mi9.com/compress/?h=${params.h}&p=zip&token=${params.token}&ip=${params.ip}&google_id=${params.google_id}&t=${params.t}`;
        
        const streamData = this._fetchStream(compressUrl);
        if (!streamData) return null;

        let finalDownloadUrl = null;
        const lines = streamData.split('\n');

        for (const line of lines) {
            if (line.trim().startsWith('data:')) {
                const jsonStr = line.replace(/^data:\s*/, '').trim();
                if (!jsonStr) continue;

                try {
                    const parsedObj = JSON.parse(jsonStr);
                    if (parsedObj.status === 'ready' && parsedObj.download_url) {
                        finalDownloadUrl = parsedObj.download_url;
                    }
                } catch (e) {                   
                }
            }
        }

        return finalDownloadUrl;
    }

    fetchAndGetApk(packageName) {
        const info = this.search(packageName);
        
        if (!info) {
            return { error: "Data aplikasi tidak ditemukan" };
        }

        if (info._compressParams) {
            const finalApkUrl = this.getMergedApk(info._compressParams);
            info.finalMergedApkUrl = finalApkUrl;
            delete info._compressParams; 
        }

        return info;
    }
}
