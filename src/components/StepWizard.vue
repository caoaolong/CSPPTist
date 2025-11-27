<template>
  <div class="step-wizard">
    <!-- 步骤条 -->
    <div class="steps">
      <div class="step-item" v-for="(step, index) in steps" :key="index" :class="{
        'active': currentStep === index + 1,
        'completed': currentStep > index + 1
      }">
        <div class="step-number">{{ index + 1 }}</div>
        <div class="step-title">{{ step.title }}</div>
      </div>
    </div>

    <!-- 步骤内容 -->
    <div class="step-content">
      <!-- 第一步：Markdown 内容 -->
      <div v-if="currentStep === 1" class="step-panel markdown-panel">
        <div class="markdown-loading" v-if="outlineLoading">
          <FullscreenSpin :loading="true" tip="加载说明内容中..." />
        </div>
        <div class="markdown-empty" v-else-if="!outlineContent">
          暂无说明内容
        </div>
        <div class="markdown-content" v-else>
          <div v-for="(block, blockIndex) in markdownBlocks" :key="blockIndex" class="markdown-block"
            :class="`markdown-block-${block.type}`">
            <template v-if="block.type === 'heading'">
              <div class="markdown-heading" :class="`level-${block.level}`">
                <template v-for="(part, partIndex) in block.parts" :key="partIndex">
                  <vue-latex v-if="part.type === 'latex'" :expression="part.content"
                    :fontsize="block.level === 1 ? 26 : block.level === 2 ? 22 : 18" class="markdown-latex" />
                  <strong v-else-if="part.type === 'bold'" v-html="convertTextToHtml(part.content)"></strong>
                  <span v-else v-html="convertTextToHtml(part.content)"></span>
                </template>
              </div>
            </template>
            <template v-else-if="block.type === 'paragraph'">
              <p class="markdown-paragraph">
                <template v-for="(part, partIndex) in block.parts" :key="partIndex">
                  <vue-latex v-if="part.type === 'latex'" :expression="part.content" :fontsize="16"
                    class="markdown-latex" />
                  <strong v-else-if="part.type === 'bold'" v-html="convertTextToHtml(part.content)"></strong>
                  <span v-else v-html="convertTextToHtml(part.content)"></span>
                </template>
              </p>
            </template>
            <template v-else-if="block.type === 'ordered-list'">
              <ol class="markdown-list ordered">
                <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
                  <template v-for="(part, partIndex) in item" :key="partIndex">
                    <vue-latex v-if="part.type === 'latex'" :expression="part.content" :fontsize="16"
                      class="markdown-latex" />
                    <strong v-else-if="part.type === 'bold'" v-html="convertTextToHtml(part.content)"></strong>
                    <span v-else v-html="convertTextToHtml(part.content)"></span>
                  </template>
                </li>
              </ol>
            </template>
            <template v-else-if="block.type === 'unordered-list'">
              <ul class="markdown-list unordered">
                <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
                  <template v-for="(part, partIndex) in item" :key="partIndex">
                    <vue-latex v-if="part.type === 'latex'" :expression="part.content" :fontsize="16"
                      class="markdown-latex" />
                    <strong v-else-if="part.type === 'bold'" v-html="convertTextToHtml(part.content)"></strong>
                    <span v-else v-html="convertTextToHtml(part.content)"></span>
                  </template>
                </li>
              </ul>
            </template>
            <template v-else-if="block.type === 'divider'">
              <div class="markdown-divider"></div>
            </template>
          </div>
        </div>
      </div>

      <!-- 第二步：模板列表 -->
      <div v-if="currentStep === 2" class="step-panel template-panel">
        <div v-if="loadingTemplates" class="loading-templates">
          <FullscreenSpin :loading="true" tip="加载模板列表中..." />
        </div>
        <div v-else-if="templates.length === 0" class="empty-templates">
          <div class="empty-text">暂无可用模板</div>
        </div>
        <div v-else class="template-list">
          <div class="template-item" v-for="template in templates" :key="template.id"
            :class="{ 'selected': selectedTemplateId === template.id }" @click="selectTemplate(template.id)">
            <div class="template-thumbnail">
              <ThumbnailSlide v-if="template.slides && template.slides.length > 0" :slide="template.slides[0]"
                :size="200" :visible="true" />
              <div v-else class="empty-thumbnail">无预览</div>
            </div>
            <div class="template-info">
              <div class="template-title">{{ template.title || '未命名模板' }}</div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- 操作按钮 -->
    <div class="step-actions">
      <button class="btn btn-secondary" @click="prevStep" :disabled="currentStep === 1">
        上一步
      </button>
      <button class="btn btn-primary" @click="nextStep" :disabled="!canGoNext">
        {{ currentStep === steps.length ? '完成' : '下一步' }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import ThumbnailSlide from '@/views/components/ThumbnailSlide/index.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'
import api from '@/services'
import type { Slide } from '@/types/slides'
import message from '@/utils/message'

interface Template {
  id: string
  title?: string
  slides?: Slide[]
}

const props = withDefaults(defineProps<{
  markdownContent?: string
  outlineId?: string
}>(), {
  markdownContent: '# 欢迎使用 PPT 生成工具\n\n请按照以下步骤完成操作：\n\n1. 查看说明文档\n2. 选择模板\n3. 等待生成完成',
  outlineId: '1',
})

const emit = defineEmits<{
  (event: 'complete', templateData?: any): void
  (event: 'close'): void
  (event: 'stream-data', data: any): void
  (event: 'stream-complete'): void
  (event: 'stream-error', error: any): void
}>()

// 通过 inject 获取父组件提供的事件处理函数（避免 Teleport 导致的事件传递问题）
const handleStreamData = inject<(data: any) => void>('handleStreamData')
const handleStreamComplete = inject<() => void>('handleStreamComplete')
const handleStreamError = inject<(error: any) => void>('handleStreamError')

const steps = [
  { title: '查看说明' },
  { title: '选择模板' },
]

const currentStep = ref(1)
const selectedTemplateId = ref<string | null>(null)
const templates = ref<Template[]>([])
const loadingTemplates = ref(false)
const outlineContent = ref(props.markdownContent)
const outlineLoading = ref(false)
const outlineFetched = ref(false)

interface MarkdownInlinePart {
  type: 'text' | 'bold' | 'latex'
  content: string
}

interface MarkdownBlock {
  type: 'heading' | 'paragraph' | 'ordered-list' | 'unordered-list' | 'divider'
  level?: number
  parts?: MarkdownInlinePart[]
  items?: MarkdownInlinePart[][]
}

const markdownBlocks = computed<MarkdownBlock[]>(() => {
  return parseMarkdownBlocks(outlineContent.value || '')
})

// 将 markdown 转换为 HTML
// 是否可以进入下一步
const canGoNext = computed(() => {
  if (currentStep.value === 2) {
    return selectedTemplateId.value !== null
  }
  return true
})

interface OutlineData {
  id: number
  content?: string
  [key: string]: any
}

const outline = ref<OutlineData | null>(null)

const loadOutlineContent = async () => {
  if (!props.outlineId || outlineFetched.value || outlineLoading.value) return
  
  // 如果已经通过 props 传入了有效的大纲内容（不是默认内容），就不再调用接口
  const defaultContents = [
    '# 欢迎使用 PPT 生成工具\n\n请按照以下步骤完成操作：\n\n1. 查看说明文档\n2. 选择模板\n3. 等待生成完成',
    '# 欢迎使用 PPT 生成工具\n\n请按照以下步骤完成操作：\n\n## 第一步：查看说明\n\n本工具可以帮助您快速生成专业的 PPT 演示文稿。\n\n## 第二步：选择模板\n\n在模板列表中选择一个您喜欢的模板，每个模板都展示了第一页的预览效果。\n\n## 第三步：生成进度\n\n选择模板后，系统将自动生成您的 PPT，请耐心等待。\n\n---\n\n**提示**：您可以在第二步中选择不同的模板来查看预览效果。'
  ]
  if (props.markdownContent && !defaultContents.includes(props.markdownContent)) {
    // outlineContent 会通过 watch 自动更新，这里只需要标记为已获取
    outlineFetched.value = true
    return
  }
  
  const outlineIdStr = String(props.outlineId)
  try {
    outlineLoading.value = true
    const response = await api.getPPTOutline(outlineIdStr)
    if (response && response?.data) {
      outline.value = response.data
    }
    const content = response?.content || response?.data?.content
    if (content) {
      outlineContent.value = content
    }
  }
  catch (err: any) {
    const errorMsg = err?.message || '未知错误'
    message.error(`加载步骤说明失败: ${errorMsg}`)
  }
  finally {
    outlineLoading.value = false
    outlineFetched.value = true
  }
}

watch(() => props.markdownContent, (val) => {
  // 如果 markdownContent 有值，就更新 outlineContent
  if (val) {
    // 定义可能的默认内容（App.vue 和 StepWizard 的默认内容可能不同）
    const defaultContents = [
      '# 欢迎使用 PPT 生成工具\n\n请按照以下步骤完成操作：\n\n1. 查看说明文档\n2. 选择模板\n3. 等待生成完成',
      '# 欢迎使用 PPT 生成工具\n\n请按照以下步骤完成操作：\n\n## 第一步：查看说明\n\n本工具可以帮助您快速生成专业的 PPT 演示文稿。\n\n## 第二步：选择模板\n\n在模板列表中选择一个您喜欢的模板，每个模板都展示了第一页的预览效果。\n\n## 第三步：生成进度\n\n选择模板后，系统将自动生成您的 PPT，请耐心等待。\n\n---\n\n**提示**：您可以在第二步中选择不同的模板来查看预览效果。'
    ]
    
    // 检查是否是默认内容
    const isDefaultContent = defaultContents.includes(val)
    
    // 如果内容不是默认内容，说明是从接口获取的新内容，总是更新
    if (!isDefaultContent) {
      outlineContent.value = val
    }
    else if (!outlineFetched.value) {
      // 是默认内容，但还没有获取过，也更新
      outlineContent.value = val
    }
  }
}, { immediate: true })

watch(() => props.outlineId, () => {
  outlineFetched.value = false
  outlineContent.value = props.markdownContent
  if (currentStep.value === 1) {
    loadOutlineContent()
  }
})

const convertTextToHtml = (text: string) => {
  if (!text) return ''
  return escapeHtml(text)
    .replace(/ {2}/g, '&nbsp;&nbsp;')
    .replace(/\n/g, '<br>')
}

const parseMarkdownBlocks = (content: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = []
  if (!content) return blocks

  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')

  let paragraphBuffer: string[] = []
  let listBuffer: MarkdownInlinePart[][] = []
  let listType: 'ordered-list' | 'unordered-list' | null = null

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return
    const paragraphText = paragraphBuffer.join('\n')
    if (paragraphText.trim()) {
      blocks.push({
        type: 'paragraph',
        parts: parseInlineParts(paragraphText),
      })
    }
    paragraphBuffer = []
  }

  const flushList = () => {
    if (listBuffer.length && listType) {
      blocks.push({
        type: listType,
        items: listBuffer,
      })
    }
    listBuffer = []
    listType = null
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()

    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        parts: parseInlineParts(headingMatch[2]),
      })
      continue
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'divider' })
      continue
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (orderedMatch) {
      flushParagraph()
      if (listType !== 'ordered-list') {
        flushList()
        listType = 'ordered-list'
      }
      listBuffer.push(parseInlineParts(orderedMatch[2]))
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (unorderedMatch) {
      flushParagraph()
      if (listType !== 'unordered-list') {
        flushList()
        listType = 'unordered-list'
      }
      listBuffer.push(parseInlineParts(unorderedMatch[1]))
      continue
    }

    if (listBuffer.length) {
      flushList()
    }
    paragraphBuffer.push(rawLine)
  }

  flushParagraph()
  flushList()

  return blocks
}

const parseInlineParts = (text: string): MarkdownInlinePart[] => {
  const parts: MarkdownInlinePart[] = []
  if (!text) return parts

  const regex = /(\$\$[^$]+\$\$|\$[^$]+\$|\*\*[^*]+\*\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const index = match.index || 0
    if (index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, index),
      })
    }

    const token = match[0]
    if (token.startsWith('**')) {
      parts.push({
        type: 'bold',
        content: token.slice(2, -2),
      })
    }
    else {
      const expression = token.startsWith('$$') ? token.slice(2, -2) : token.slice(1, -1)
      parts.push({
        type: 'latex',
        content: expression.trim(),
      })
    }

    lastIndex = index + token.length
  }

  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex),
    })
  }

  return mergeTextParts(parts)
}

const mergeTextParts = (parts: MarkdownInlinePart[]): MarkdownInlinePart[] => {
  const merged: MarkdownInlinePart[] = []
  for (const part of parts) {
    if (part.type === 'text') {
      if (!part.content) continue
      const last = merged[merged.length - 1]
      if (last && last.type === 'text') {
        last.content += part.content
      }
      else {
        merged.push({ ...part })
      }
    }
    else {
      merged.push(part)
    }
  }
  return merged
}

const escapeHtml = (str: string) => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 加载模板列表
const loadTemplates = async () => {
  try {
    loadingTemplates.value = true
    const response = await api.listPPTTemplate()

    // 处理响应数据：接口返回格式为 { code: 0, data: [...], msg: "" }
    let templateList: any[] = []

    if (response) {
      // 优先使用 response.data
      if (response.data && Array.isArray(response.data)) {
        templateList = response.data
      }
      // 兼容直接返回数组的情况
      else if (Array.isArray(response)) {
        templateList = response
      }
    }
    // 将接口数据转换为组件需要的格式（用于显示）
    // 接口返回的模板对象包含: slides, title, width, height, theme
    // 需要为每个模板生成唯一 ID（使用索引）
    templates.value = templateList.map((template) => ({
      id: template.id,
      title: template.title,
      slides: template.slides || [],
    }))
  }
  catch (err: any) {
    const errorMsg = err?.message || '未知错误'
    message.error(`加载模板列表失败: ${errorMsg}`)
  }
  finally {
    loadingTemplates.value = false
  }
}

// 选择模板
const selectTemplate = (templateId: string) => {
  selectedTemplateId.value = templateId
}

// 上一步
const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

// 下一步
const nextStep = async () => {
  if (currentStep.value === 1) {
    // 第一步：直接进入下一步
    currentStep.value++
    return
  }

  if (currentStep.value === 2) {
    // 第二步：需要选择模板，然后创建任务并运行
    if (!selectedTemplateId.value) {
      message.error('请先选择模板')
      return
    }

    // 先加载选择的模板数据
    try {
      const templateResponse = await api.getPPTTemplate(selectedTemplateId.value)
      let templateData = templateResponse
      if (templateResponse.data) {
        templateData = templateResponse.data
      }

      // 如果模板数据有效，通过 complete 事件传递给父组件加载
      // 注意：即使模板没有 slides 字段，也要加载（因为会清空 slides）
      if (templateData) {
        emit('complete', templateData)
      }
    }
    catch (templateErr: any) {
      // eslint-disable-next-line no-console
      console.warn('加载模板数据失败，继续执行任务创建:', templateErr)
      // 即使加载模板失败，也继续执行任务创建
    }

    // 第二步点击下一步时，先创建任务
    try {
      // 显示加载状态
      const loadingMessage = message.info('正在创建任务...', { duration: 0 })

      // 如果没有 outline 数据，尝试获取
      if (!outline.value || !outline.value.id) {
        if (props.outlineId) {
          try {
            const outlineIdStr = String(props.outlineId)
            const response = await api.getPPTOutline(outlineIdStr)
            if (response && response?.data) {
              outline.value = response.data
            }
          }
          catch (err: any) {
            loadingMessage.close()
            const errorMsg = err?.message || '未知错误'
            message.error(`获取大纲信息失败: ${errorMsg}`)
            return
          }
        }
      }

      if (!outline.value || !outline.value.id) {
        loadingMessage.close()
        message.error('大纲信息缺失或格式错误')
        return
      }
      // 调用 createTask 接口
      const createTaskResponse = await api.createTask(outline.value.id, selectedTemplateId.value)

      // 获取 taskId（从响应中提取）
      let taskId: number | undefined

      // 处理不同的响应格式
      if (createTaskResponse?.data) {
        // 如果响应有 data 字段
        taskId = createTaskResponse.data
      }

      if (!taskId || Number.isNaN(taskId)) {
        loadingMessage.close()
        message.error(`创建任务失败：无法获取任务ID。响应数据: ${JSON.stringify(createTaskResponse)}`)
        return
      }

      // 更新加载提示
      loadingMessage.close()
      const streamMessage = message.info('正在生成 PPT...', { duration: 0 })

      // 使用 EventSource 处理 SSE 流
      try {
        const eventSource = api.runTask(taskId)
        // 监听 message 事件（默认事件类型）
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            // eslint-disable-next-line no-console
            console.log('StepWizard 收到 SSE 消息:', data)
            
            // 提取 checkedData
            const checkedData = data.checkedData || data.data
            
            if (!checkedData) {
              // eslint-disable-next-line no-console
              console.warn('SSE 消息中没有 checkedData:', data)
              return
            }
            
            // eslint-disable-next-line no-console
            console.log('StepWizard 准备 emit stream-data:', checkedData)
            
            // 检查是否是完成信号
            if (checkedData.type === 'complete') {
              // eslint-disable-next-line no-console
              console.log('StepWizard 收到完成信号，准备发送 stream-complete')
              if (handleStreamComplete) {
                handleStreamComplete()
              }
              else {
                emit('stream-complete')
              }
              eventSource.close()
              return
            }
            
            // 发送数据事件 - 优先使用 inject 的函数，如果没有则使用 emit
            // eslint-disable-next-line no-console
            console.log('StepWizard 准备发送 stream-data，数据:', checkedData)
            if (handleStreamData) {
              // eslint-disable-next-line no-console
              console.log('StepWizard 使用 inject 的 handleStreamData')
              handleStreamData(checkedData)
            }
            else {
              // eslint-disable-next-line no-console
              console.log('StepWizard 使用 emit stream-data')
              emit('stream-data', checkedData)
            }
            // eslint-disable-next-line no-console
            console.log('StepWizard 已发送 stream-data')
          }
          catch (e) {
            // eslint-disable-next-line no-console
            console.error('StepWizard 解析 SSE 数据失败:', e, event.data)
          }
        }
      }
      catch (streamErr: any) {
        streamMessage.close()
        const errorMsg = streamErr?.message || '未知错误'
        message.error(`生成 PPT 失败: ${errorMsg}`)
        if (handleStreamError) {
          handleStreamError(streamErr)
        }
        else {
          emit('stream-error', streamErr)
        }
      }
    }
    catch (err: any) {
      const errorMsg = err?.message || '未知错误'
      message.error(`创建任务失败: ${errorMsg}`)
    }
  }
}


// 监听步骤变化，在进入第二步时加载模板
watch(currentStep, (newStep) => {
  if (newStep === 1) {
    loadOutlineContent()
  }
  if (newStep === 2 && templates.value.length === 0) {
    loadTemplates()
  }
})

onMounted(() => {
  if (currentStep.value === 1) {
    loadOutlineContent()
  }
  // 在进入第二步时加载模板列表
  if (currentStep.value === 2) {
    loadTemplates()
  }
})
</script>

<style lang="scss" scoped>
.step-wizard {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.steps {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 16px;
    left: 50%;
    width: 100%;
    height: 2px;
    background-color: #e8e8e8;
    z-index: 0;
  }

  &:last-child::after {
    display: none;
  }

  &.active {
    .step-number {
      background-color: $themeColor;
      color: #fff;
      border-color: $themeColor;
    }

    .step-title {
      color: $themeColor;
      font-weight: 500;
    }
  }

  &.completed {
    .step-number {
      background-color: #52c41a;
      color: #fff;
      border-color: #52c41a;
    }

    .step-title {
      color: #52c41a;
    }
  }
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #f5f5f5;
  color: #999;
  border: 2px solid #e8e8e8;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  font-weight: 500;
  position: relative;
  z-index: 1;
  transition: all 0.3s;
}

.step-title {
  font-size: 14px;
  color: #999;
  transition: all 0.3s;
}

.step-content {
  min-height: 400px;
  padding: 20px;
}

.step-panel {
  width: 100%;
  height: 100%;
}

.markdown-panel {
  .markdown-content {
    padding: 20px;
    background-color: #f9f9f9;
    border-radius: 4px;
    line-height: 1.8;
    max-height: 400px;
    overflow-y: auto;

    :deep(h1) {
      font-size: 24px;
      margin: 16px 0;
      font-weight: 600;
    }

    :deep(h2) {
      font-size: 20px;
      margin: 14px 0;
      font-weight: 600;
    }

    :deep(h3) {
      font-size: 18px;
      margin: 12px 0;
      font-weight: 600;
    }

    :deep(p) {
      margin: 8px 0;
    }

    :deep(ul),
    :deep(ol) {
      margin: 8px 0;
      padding-left: 24px;
    }

    :deep(li) {
      margin: 4px 0;
    }

    :deep(code) {
      background-color: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }

    :deep(pre) {
      background-color: #f0f0f0;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
    }
  }

  .markdown-loading,
  .markdown-empty {
    min-height: 200px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .markdown-empty {
    color: #999;
    font-size: 14px;
  }
}

.template-panel {
  .template-list {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    max-height: 400px;
    overflow-y: auto;
    padding: 10px;
  }

  .template-item {
    width: 240px;
    cursor: pointer;
    border: 2px solid #e8e8e8;
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.3s;
    background-color: #fff;

    &:hover {
      border-color: $themeColor;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    &.selected {
      border-color: $themeColor;
      box-shadow: 0 2px 12px rgba(209, 68, 36, 0.3);
    }
  }

  .template-thumbnail {
    width: 100%;
    height: 150px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #f5f5f5;
    overflow: hidden;
  }

  .empty-thumbnail {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #999;
    font-size: 14px;
  }

  .template-info {
    padding: 12px;
  }

  .template-title {
    font-size: 14px;
    color: #333;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loading-templates {
    height: 400px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .empty-templates {
    height: 400px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .empty-text {
    color: #999;
    font-size: 14px;
  }
}


.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #e8e8e8;
}

.btn {
  padding: 8px 24px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;

  &.btn-secondary {
    background-color: #f5f5f5;
    color: #333;

    &:hover:not(:disabled) {
      background-color: #e8e8e8;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &.btn-primary {
    background-color: $themeColor;
    color: #fff;

    &:hover:not(:disabled) {
      background-color: darken($themeColor, 10%);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}
</style>
