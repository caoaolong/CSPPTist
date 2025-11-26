<template>
  <div class="template-preview">
    <FullscreenSpin :loading="loading" tip="加载模板中，请稍等 ..." />
    <div class="preview-wrapper" v-if="!loading && slides.length > 0">
      <div class="preview-container">
        <div class="slides-list">
          <div 
            class="slide-item" 
            v-for="(slide, index) in slides" 
            :key="slide.id"
            :id="`slide-${slide.id}`"
            :data-type="slide.type || ''"
          >
            <ThumbnailSlide :slide="slide" :size="previewSize" :visible="index < slidesLoadLimit" />
          </div>
        </div>
      </div>
      <div class="navigation-sidebar">
        <div 
          class="nav-item" 
          v-for="navItem in navigationItems" 
          :key="navItem.type"
          :class="{ 'active': navItem.count > 0 }"
          @click="scrollToType(navItem.type)"
        >
          <div class="nav-label">{{ navItem.label }}</div>
          <div class="nav-count">{{ navItem.count }}</div>
        </div>
      </div>
    </div>
    <div class="error-message" v-if="!loading && error">
      {{ error }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import { useSlidesStore } from '@/store'
import api from '@/services'
import type { Slide, SlideType } from '@/types/slides'
import ThumbnailSlide from '@/views/components/ThumbnailSlide/index.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'

const slidesStore = useSlidesStore()

const loading = ref(true)
const error = ref('')
const slides = ref<Slide[]>([])
const slidesLoadLimit = ref(50)

// 导航项配置
const navConfig = [
  { type: 'cover' as SlideType, label: '封面' },
  { type: 'contents' as SlideType, label: '目录' },
  { type: 'transition' as SlideType, label: '过渡页' },
  { type: 'content' as SlideType, label: '内容页' },
  { type: 'end' as SlideType, label: '结尾页' },
]

// 计算各类型的数量
const navigationItems = computed(() => {
  return navConfig.map(config => {
    const count = slides.value.filter(slide => slide.type === config.type).length
    return {
      ...config,
      count,
    }
  })
})

// 滚动到指定类型的第一张幻灯片
const scrollToType = (type: SlideType) => {
  const firstSlide = slides.value.find(slide => slide.type === type)
  if (firstSlide) {
    const element = document.getElementById(`slide-${firstSlide.id}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
}

// 计算预览尺寸，根据容器宽度自适应
const previewSize = computed(() => {
  const containerWidth = document.body.clientWidth || 1200
  // 减去导航栏宽度和padding
  return Math.min(containerWidth - 200, 800)
})

// 从URL参数获取模板ID
const getTemplateIdFromURL = (): string | null => {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('templateId') || urlParams.get('id')
}

// 加载模板数据
const loadTemplate = async (templateId: string) => {
  try {
    loading.value = true
    error.value = ''

    const response = await api.getPPTTemplate(templateId)

    // 根据接口返回的数据结构解析
    // 假设接口返回格式为 { slides: Slide[], theme?: SlideTheme } 或直接是 { slides, theme }
    let templateData = response
    if (response.data) {
      templateData = response.data
    }

    if (templateData.slides && Array.isArray(templateData.slides)) {
      slides.value = templateData.slides

      // 如果有主题，设置主题
      if (templateData.theme) {
        slidesStore.setTheme(templateData.theme)
      }

      // 渐进式加载幻灯片
      loadSlidesProgressively()
    }
    else {
      error.value = '模板数据格式错误'
    }
  }
  catch (err: any) {
    error.value = err?.message || '加载模板失败，请检查模板ID是否正确'
  }
  finally {
    loading.value = false
  }
}

// 渐进式加载幻灯片，提升性能
const loadSlidesProgressively = () => {
  if (slides.value.length <= slidesLoadLimit.value) {
    slidesLoadLimit.value = slides.value.length
    return
  }

  setTimeout(() => {
    slidesLoadLimit.value = Math.min(slidesLoadLimit.value + 20, slides.value.length)
    if (slidesLoadLimit.value < slides.value.length) {
      loadSlidesProgressively()
    }
  }, 300)
}

onMounted(() => {
  const templateId = getTemplateIdFromURL()
  if (!templateId) {
    error.value = '缺少模板ID参数，请使用 ?templateId=xxx 或 ?id=xxx'
    loading.value = false
    return
  }

  loadTemplate(templateId)
})
</script>

<style lang="scss" scoped>
.template-preview {
  width: 100%;
  height: 100vh;
  background-color: #f5f5f5;
  overflow: hidden;
  position: relative;
}

.preview-wrapper {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.preview-container {
  flex: 1;
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  box-sizing: border-box;
}

.slides-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.slide-item {
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  background: #fff;
  border-radius: 4px;
  overflow: hidden;
  scroll-margin-top: 20px;
}

.navigation-sidebar {
  width: 160px;
  height: 100vh;
  background-color: #fff;
  border-left: 1px solid #e8e8e8;
  padding: 20px 0;
  box-sizing: border-box;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-item {
  padding: 12px 20px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-left: 3px solid transparent;

  &:hover {
    background-color: #f5f5f5;
  }

  &.active {
    border-left-color: #d14424;
    background-color: #fff5f3;

    .nav-label {
      color: #d14424;
      font-weight: 500;
    }

    .nav-count {
      color: #d14424;
    }
  }

  &:not(.active) {
    opacity: 0.6;

    .nav-count {
      color: #999;
    }
  }
}

.nav-label {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
}

.nav-count {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.error-message {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #ff4d4f;
  font-size: 16px;
  text-align: center;
  padding: 20px;
  box-sizing: border-box;
}
</style>
