<template>
  <!-- 预览模式：通过URL参数 templateId 或 id 触发 -->
  <TemplatePreview v-if="isPreviewMode" />

  <!-- 正常编辑模式 -->
  <template v-else-if="slides.length">
    <Screen v-if="screening" />
    <Editor v-else-if="_isPC" />
    <Mobile v-else />
  </template>
  <FullscreenSpin tip="数据初始化中，请稍等 ..." v-else loading :mask="false" />

  <!-- 步骤条窗口 -->
  <Modal :visible="showStepWizard" :width="900" :closeOnClickMask="false" :closeOnEsc="false" closeButton
    @closed="handleStepWizardClose">
    <StepWizard :markdownContent="markdownContent" :outline-id="outlineId || '1'" @complete="handleStepWizardComplete"
      @close="() => { mainStore.setStepWizardState(false); mainStore.setRegeneratingPPTState(false) }" @stream-data="handleStreamData" @stream-complete="handleStreamComplete"
      @stream-error="handleStreamError" />
  </Modal>

  <!-- PPT 生成中的 loading 效果 -->
  <FullscreenSpin v-if="isGeneratingPPT" :loading="true" :mask="true" tip="正在生成 PPT，请稍等 ..." />
</template>



<script lang="ts" setup>
import { onMounted, computed, ref, provide, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useScreenStore, useMainStore, useSnapshotStore, useSlidesStore } from '@/store'
import { LOCALSTORAGE_KEY_DISCARDED_DB } from '@/configs/storage'
import { deleteDiscardedDB } from '@/utils/database'
import { isPC } from '@/utils/common'
import useAddSlidesOrElements from '@/hooks/useAddSlidesOrElements'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'
import message from '@/utils/message'
import api from '@/services'

import Editor from './views/Editor/index.vue'
import Screen from './views/Screen/index.vue'
import Mobile from './views/Mobile/index.vue'
import TemplatePreview from './views/TemplatePreview/index.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'
import Modal from '@/components/Modal.vue'
import StepWizard from '@/components/StepWizard.vue'

const _isPC = isPC()

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const snapshotStore = useSnapshotStore()
const { databaseId, showStepWizard, isRegeneratingPPT } = storeToRefs(mainStore)
const { slides } = storeToRefs(slidesStore)
const { screening } = storeToRefs(useScreenStore())

const { addSlidesFromData } = useAddSlidesOrElements()
const { addHistorySnapshot } = useHistorySnapshot()

const urlParams = new URLSearchParams(window.location.search)
const previewTemplateParam = urlParams.get('templateId') || urlParams.get('id')
const outlineId = urlParams.get('outlineId')

// 检查是否有任何 URL 参数
const hasUrlParams = computed(() => {
  return urlParams.toString().length > 0
})
const markdownContent = ref(`# 欢迎使用 PPT 生成工具

请按照以下步骤完成操作：

## 第一步：查看说明

本工具可以帮助您快速生成专业的 PPT 演示文稿。

## 第二步：选择模板

在模板列表中选择一个您喜欢的模板，每个模板都展示了第一页的预览效果。

## 第三步：生成进度

选择模板后，系统将自动生成您的 PPT，请耐心等待。

---

**提示**：您可以在第二步中选择不同的模板来查看预览效果。`)

// 用于收集partial类型的消息内容
const partialMessages = ref<string[]>([])

// PPT 生成状态
const isGeneratingPPT = ref(false)

// 检查是否为预览模式（通过URL参数判断）
const isPreviewMode = computed(() => {
  return !!previewTemplateParam
})

// 加载模板数据（根据模板数据对象）
const loadTemplateData = (templateData: any) => {
  try {
    if (!templateData) {
      throw new Error('模板数据格式错误：缺少模板数据')
    }

    // 如果有主题，设置主题
    if (templateData.theme) {
      slidesStore.setTheme(templateData.theme)
    }

    // 清空slides数组，只保留主题信息
    slidesStore.setSlides([])
    slidesStore.updateSlideIndex(0)
    addHistorySnapshot()
  }
  catch (err: any) {
    const errorMsg = err?.message || '未知错误'
    message.error(`无法加载模板数据: ${errorMsg}`)
  }
}

// 处理步骤条完成事件
const handleStepWizardComplete = async (templateData?: any) => {
  mainStore.setStepWizardState(false)

  // 如果用户选择了模板，加载模板数据
  if (templateData) {
    loadTemplateData(templateData)
  }
  else {
    // 如果没有选择模板，加载默认模板 template_1
    await loadTemplate1()
  }
}

// 处理步骤条关闭事件
const handleStepWizardClose = () => {
  mainStore.setStepWizardState(false)
  mainStore.setRegeneratingPPTState(false)
}

// 处理 SSE 流式数据
const handleStreamData = (streamData: any) => {
  // eslint-disable-next-line no-console
  console.log('App.vue handleStreamData 被调用，收到数据:', streamData)

  // 第一次收到流式数据时，显示 loading
  if (!isGeneratingPPT.value) {
    isGeneratingPPT.value = true
    
    // 如果是重新生成PPT，先清空当前PPT内容
    if (isRegeneratingPPT.value) {
      slidesStore.setSlides([])
      slidesStore.updateSlideIndex(0)
      mainStore.setActiveElementIdList([])
      addHistorySnapshot()
      mainStore.setRegeneratingPPTState(false)
    }
  }

  // 处理流式数据
  if (!streamData) {
    return
  }
  // 处理 type 为 "tool" 的数据，这些数据包含幻灯片内容
  if (streamData && streamData.type === 'tool' && streamData.content) {
    try {
      // content 是一个 JSON 字符串（可能是转义的），需要解析
      const contentStr = streamData.content
      let slideData: any

      // 如果 content 是字符串，尝试解析
      if (typeof contentStr === 'string') {
        try {
          // 先尝试解析一次
          const firstParse = JSON.parse(contentStr)

          // 如果解析结果是字符串，说明是双重转义的 JSON，需要再解析一次
          if (typeof firstParse === 'string') {
            slideData = JSON.parse(firstParse)
          }
          else {
            // 如果解析结果已经是对象，直接使用
            slideData = firstParse
          }
        }
        catch (parseError) {
          // 如果第一次解析失败，尝试其他方式
          // eslint-disable-next-line no-console
          console.warn('第一次 JSON 解析失败，尝试其他方式:', parseError)

          // 尝试移除可能的转义字符
          try {
            const unescaped = contentStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
            slideData = JSON.parse(unescaped)
          }
          catch {
            // eslint-disable-next-line no-console
            console.error('无法解析 content 数据:', contentStr)
            throw parseError
          }
        }
      }
      else {
        // 如果 content 不是字符串，直接使用
        slideData = contentStr
      }

      // eslint-disable-next-line no-console
      console.log('解析后的 slideData:', slideData)

      // 将解析出的数据作为单张幻灯片添加到slides数组中
      // 只要解析出的数据有 id 和 elements 字段，就作为一张幻灯片添加
      if (slideData && slideData.id && slideData.elements && Array.isArray(slideData.elements)) {
        // eslint-disable-next-line no-console
        console.log('准备添加幻灯片，slideData:', slideData)
        addSlidesFromData([slideData])
        // eslint-disable-next-line no-console
        console.log('幻灯片已添加，当前 slides 数量:', slides.value.length)
      }
      else {
        // eslint-disable-next-line no-console
        console.warn('slideData 格式不正确，缺少必要字段:', {
          hasId: !!slideData?.id,
          hasElements: !!slideData?.elements,
          isElementsArray: Array.isArray(slideData?.elements),
          slideData
        })
      }
    }
    catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('解析流式数据失败:', err, '原始数据:', streamData)
      message.error(`解析幻灯片数据失败: ${err?.message || '未知错误'}`)
    }
  }
  // 处理 type 为 "partial" 的数据，收集内容用于后续显示
  else if (streamData.type === 'partial' && streamData.content) {
    // 收集partial类型的消息内容
    if (typeof streamData.content === 'string') {
      partialMessages.value.push(streamData.content)
    }
  }
  // 处理 type 为 "complete" 的数据，表示生成完成
  else if (streamData.type === 'complete') {
    // eslint-disable-next-line no-console
    console.log('PPT 生成完成:', streamData.content)
  }
}

// 处理 SSE 流完成
const handleStreamComplete = () => {
  // eslint-disable-next-line no-console
  console.log('App.vue handleStreamComplete 被调用')

  // 隐藏 loading
  isGeneratingPPT.value = false

  // 如果收集到了 partial 消息，显示连接后的内容
  if (partialMessages.value.length > 0) {
    const combinedContent = partialMessages.value.join('')
    if (combinedContent.trim()) {
      message.info(combinedContent, { duration: 5000 })
    }
    // 清空 partial 消息数组
    partialMessages.value = []
  }

  message.success('PPT 生成完成！')
}

// 处理 SSE 流错误
const handleStreamError = (error: any) => {
  // eslint-disable-next-line no-console
  console.error('流式数据传输错误:', error)

  // 隐藏 loading
  isGeneratingPPT.value = false

  message.error(`生成 PPT 时发生错误: ${error?.message || '未知错误'}`)
}

// 提供事件处理方法，让 StepWizard 可以直接调用（通过 provide/inject）
// 注意：需要在函数定义之后 provide
provide('handleStreamData', handleStreamData)
provide('handleStreamComplete', handleStreamComplete)
provide('handleStreamError', handleStreamError)

if (import.meta.env.MODE !== 'development') {
  window.onbeforeunload = () => false
}

// 加载默认模板（从 listPPTTemplate 获取第一个模板）
const loadTemplate1 = async () => {
  try {
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

    // 获取第一个模板
    if (templateList.length === 0) {
      throw new Error('模板列表为空')
    }

    const jsonData = templateList[0]

    // 检查数据结构
    if (!jsonData || !jsonData.slides) {
      throw new Error('JSON 数据格式错误：缺少 slides 字段')
    }

    const { slides: templateSlides } = jsonData

    // 检查 slides 是否为有效数组
    if (!Array.isArray(templateSlides) || templateSlides.length === 0) {
      throw new Error('JSON 数据格式错误：slides 不是有效数组或为空')
    }

    // 如果有主题，设置主题
    if (jsonData.theme) {
      slidesStore.setTheme(jsonData.theme)
    }

    // 检查当前是否为空幻灯片（需要先检查 slides 是否存在）
    const currentSlides = slides.value
    const isCurrentlyEmpty = currentSlides.length === 0 ||
      (currentSlides.length === 1 && currentSlides[0]?.elements?.length === 0)

    if (isCurrentlyEmpty) {
      slidesStore.setSlides(templateSlides)
      addHistorySnapshot()
    }
    else {
      addSlidesFromData(templateSlides)
    }
  }
  catch (err: any) {
    const errorMsg = err?.message || '未知错误'
    message.error(`无法加载默认模板: ${errorMsg}`)
  }
}

// 加载PPT数据（从getTask接口返回的数据）
const loadPPTData = (pptData: any) => {
  // eslint-disable-next-line no-console
  console.log(pptData)
  try {
    if (!pptData) {
      throw new Error('PPT数据为空')
    }

    // 检查数据结构
    if (!pptData.slides || !Array.isArray(pptData.slides)) {
      throw new Error('PPT数据格式错误：缺少 slides 字段或 slides 不是数组')
    }

    const { slides: pptSlides } = pptData

    // 检查 slides 是否为有效数组
    if (!Array.isArray(pptSlides) || pptSlides.length === 0) {
      throw new Error('PPT数据格式错误：slides 不是有效数组或为空')
    }

    // 如果有主题，设置主题
    if (pptData.theme) {
      slidesStore.setTheme(pptData.theme)
    }

    // 清空当前slides并加载新的PPT数据
    slidesStore.setSlides(pptSlides)
    slidesStore.updateSlideIndex(0)
    addHistorySnapshot()
  }
  catch (err: any) {
    const errorMsg = err?.message || '未知错误'
    message.error(`无法加载PPT数据: ${errorMsg}`)
    // 如果加载失败，显示步骤条
    mainStore.setStepWizardState(true)
  }
}

onMounted(async () => {
  // 预览模式下不需要初始化编辑器数据
  if (isPreviewMode.value) {
    return
  }

  // 检查是否存在 outlineId
  if (outlineId) {
    try {
      // 先调用 getTask 接口检查PPT是否已经生成
      const response = await api.getTask(outlineId)
      // 检查返回数据
      // 接口可能返回格式：{ code: 0, data: {...}, msg: "" } 或直接返回 { data: {...} }
      let taskData = null
      if (response?.data) {
        taskData = response.data
      }
      else if (response && typeof response === 'object' && 'data' in response) {
        taskData = response
      }

      // 如果返回数据为空，调用 getPPTOutline 获取大纲内容
      if (!taskData) {
        try {
          // 调用 getPPTOutline 接口获取大纲内容
          const outlineResponse = await api.getPPTOutline(outlineId)
          const content = outlineResponse?.content || outlineResponse?.data?.content
          if (content) {
            markdownContent.value = content
          }
        }
        catch (outlineErr: any) {
          // 如果获取大纲失败，使用默认内容
          const errorMsg = outlineErr?.message || '未知错误'
          message.warning(`获取大纲内容失败: ${errorMsg}，使用默认内容`)
        }
        // 显示步骤条
        mainStore.setStepWizardState(true)
      }
      else {
        // 如果返回数据不为空，加载PPT数据
        loadPPTData(taskData)
      }
    }
    catch (err: any) {
      // 如果请求失败，尝试获取大纲内容
      try {
        const outlineResponse = await api.getPPTOutline(outlineId)
        const content = outlineResponse?.content || outlineResponse?.data?.content
        if (content) {
          markdownContent.value = content
        }
      }
      catch (outlineErr: any) {
        // 如果获取大纲也失败，使用默认内容
        const errorMsg = outlineErr?.message || '未知错误'
        message.warning(`获取大纲内容失败: ${errorMsg}，使用默认内容`)
      }
      // 显示步骤条
      const errorMsg = err?.message || '未知错误'
      message.error(`检查PPT状态失败: ${errorMsg}`)
      mainStore.setStepWizardState(true)
    }
  }
  // 如果没有 outlineId，但有其他 URL 参数，显示步骤条
  else if (hasUrlParams.value) {
    mainStore.setStepWizardState(true)
  }
  // 如果没有任何参数，加载默认模板
  else {
    await loadTemplate1()
  }

  await deleteDiscardedDB()
  snapshotStore.initSnapshotDatabase()
})

// 监听步骤条显示状态，当显示时如果有outlineId则获取大纲内容
watch(showStepWizard, async (visible) => {
  if (visible && outlineId) {
    try {
      // 调用 getPPTOutline 接口获取大纲内容
      const outlineResponse = await api.getPPTOutline(outlineId)
      const content = outlineResponse?.content || outlineResponse?.data?.content
      if (content) {
        markdownContent.value = content
      }
    }
    catch (err: any) {
      // 如果获取大纲失败，使用默认内容
      const errorMsg = err?.message || '未知错误'
      message.warning(`获取大纲内容失败: ${errorMsg}，使用默认内容`)
    }
  }
})

// 应用注销时向 localStorage 中记录下本次 indexedDB 的数据库ID，用于之后清除数据库
window.addEventListener('beforeunload', () => {
  const discardedDB = localStorage.getItem(LOCALSTORAGE_KEY_DISCARDED_DB)
  const discardedDBList: string[] = discardedDB ? JSON.parse(discardedDB) : []

  discardedDBList.push(databaseId.value)

  const newDiscardedDB = JSON.stringify(discardedDBList)
  localStorage.setItem(LOCALSTORAGE_KEY_DISCARDED_DB, newDiscardedDB)
})
</script>

<style lang="scss">
#app {
  height: 100%;
}
</style>