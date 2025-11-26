import axios from './config'

// export const SERVER_URL = 'http://localhost:5000'
export const SERVER_URL = '/api'

interface ImageSearchPayload {
  query: string;
  orientation?: 'landscape' | 'portrait' | 'square' | 'all';
  locale?: 'zh' | 'en';
  order?: 'popular' | 'latest';
  size?: 'large' | 'medium' | 'small';
  image_type?: 'all' | 'photo' | 'illustration' | 'vector';
  page?: number;
  per_page?: number;
}

interface AIPPTOutlinePayload {
  content: string
  language: string
  model: string
}

interface AIPPTPayload {
  content: string
  language: string
  style: string
  model: string
}

interface AIWritingPayload {
  content: string
  command: string
}

export default {
  getMockData(filename: string): Promise<any> {
    return axios.get(`./mocks/${filename}.json`)
  },

  searchImage(body: ImageSearchPayload): Promise<any> {
    return axios.post(`${SERVER_URL}/tools/img_search`, body)
  },

  AIPPT_Outline({
    content,
    language,
    model,
  }: AIPPTOutlinePayload): Promise<any> {
    return fetch(`${SERVER_URL}/tools/aippt_outline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        language,
        model,
        stream: true,
      }),
    })
  },

  AIPPT({
    content,
    language,
    style,
    model,
  }: AIPPTPayload): Promise<any> {
    return fetch(`${SERVER_URL}/tools/aippt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        language,
        model,
        style,
        stream: true,
      }),
    })
  },

  AI_Writing({
    content,
    command,
  }: AIWritingPayload): Promise<any> {
    return fetch(`${SERVER_URL}/tools/ai_writing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        command,
        model: 'ark-doubao-seed-1.6-flash',
        stream: true,
      }),
    })
  },

  getPPTTemplate(templateId: string): Promise<any> {
    return axios.get(`${SERVER_URL}/ai/tool-ppt-template/preview`, {
      params: {
        id: templateId,
      },
    })
  },

  listPPTTemplate(): Promise<any> {
    return axios.get(`${SERVER_URL}/ai/tool-ppt-template/all`, {})
  },

  getPPTOutline(id: string): Promise<any> {
    return axios.get(`${SERVER_URL}/ai/chat/message/get-by-id`, {
      params: {
        id,
      },
    })
  },

  createTask(contentId: number, templateId: string): Promise<any> {
    return axios.post(`${SERVER_URL}/ai/ppt-task/create`, {
      contentId,
      templateId,
    })
  },

  /**
   * 使用 EventSource 创建 SSE 连接来接收任务生成流
   * 注意：EventSource 只支持 GET 请求，所以通过 URL 参数传递 taskId
   * 
   * @param taskId 任务ID
   * @returns EventSource 实例，需要调用者手动处理事件
   */
  runTask(taskId: number): EventSource {
    // EventSource 只支持 GET 请求，所以通过 URL 参数传递 taskId
    const url = `${SERVER_URL}/ai/ppt-task/generate-stream?taskId=${taskId}`
    return new EventSource(url)
  }
}