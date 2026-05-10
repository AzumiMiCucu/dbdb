class ShinigamiAPI {
  constructor() {
    this.baseUrl = 'https://api.shngm.io/v1';
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 16; Infinix X6837) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.137 Mobile Safari/537.36',
      'Accept': 'application/json',
      'Accept-Encoding': 'br, gzip',
      'dnt': '1',
      'origin': 'https://09.shinigami.asia',
      'sec-gpc': '1',
      'cache-control': 'max-age=600'
    };
  }

  get #options() {
    return { method: 'GET', headers: this.headers };
  }

  async search(query, page = 1, pageSize = 30) {
    try {
      const url = new URL(`${this.baseUrl}/manga/list`);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('page_size', pageSize.toString());
      url.searchParams.append('q', query);
      url.searchParams.append('sort_order', 'desc');

      const response = await fetch(url.toString(), this.#options);
      if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

      return await response.json();
    } catch (error) {
      console.error(error.message);
      return null;
    }
  } 

  async getDetail(mangaId) {
    try {
      const [detailResponse, chapterResponse] = await Promise.all([
        fetch(`${this.baseUrl}/manga/detail/${mangaId}`, this.#options),
        fetch(`${this.baseUrl}/chapter/${mangaId}/list?page_size=3000`, this.#options)
      ]);

      if (!detailResponse.ok) throw new Error(`Gagal mengambil detail (HTTP ${detailResponse.status})`);
      if (!chapterResponse.ok) throw new Error(`Gagal mengambil chapter (HTTP ${chapterResponse.status})`);

      const [detailJson, chapterJson] = await Promise.all([
        detailResponse.json(),
        chapterResponse.json()
      ]);

      return {
        success: true,
        data: {
          info: detailJson.data,
          total_chapters: chapterJson.meta?.total_record || 0,
          chapters: chapterJson.data
        }
      };
    } catch (error) {
      console.error(error.message);
      return { success: false, error: error.message };
    }
  }

  async getChapter(chapterId) {
    try {
      const response = await fetch(`${this.baseUrl}/chapter/detail/${chapterId}`, this.#options);
      if (!response.ok) throw new Error(`Gagal mengambil detail chapter (HTTP ${response.status})`);

      const json = await response.json();

      if (json.data?.chapter?.data) {
        const baseUrl = json.data.base_url;
        const chapterPath = json.data.chapter.path;

        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const cleanPath = chapterPath.startsWith('/') ? chapterPath : `/${chapterPath}`;

        json.data.images = json.data.chapter.data.map(
          filename => `${cleanBaseUrl}${cleanPath}${filename}`
        );

        delete json.data.base_url;
        delete json.data.base_url_low;
        delete json.data.chapter;
      }

      return json;
    } catch (error) {
      console.error(error.message);
      return { retcode: -1, message: error.message, data: null };
    }
  }
}

export default ShinigamiAPI;

/* contoh penggunaan 


const api = new ShinigamiAPI();
const results = await api.search('Nano Machine');
const manga = await api.getDetail('manga-id');
const chapter = await api.getChapter('chapter-id');
*/
