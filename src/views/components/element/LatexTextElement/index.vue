<template>
    <div class="editable-element-text" :class="{ 'lock': elementInfo.lock }" :style="{
        top: elementInfo.top + 'px',
        left: elementInfo.left + 'px',
        width: elementInfo.width + 'px',
        height: elementInfo.height + 'px',
    }">
        <div class="rotate-wrapper" :style="{ transform: `rotate(${elementInfo.rotate}deg)` }">
            <div class="element-content" ref="elementRef" :style="{
                width: elementInfo.vertical ? 'auto' : elementInfo.width + 'px',
                height: elementInfo.vertical ? elementInfo.height + 'px' : 'auto',
                backgroundColor: elementInfo.fill,
                opacity: elementInfo.opacity,
                textShadow: shadowStyle,
                lineHeight: elementInfo.lineHeight,
                letterSpacing: (elementInfo.wordSpace || 0) + 'px',
                color: elementInfo.defaultColor,
                fontFamily: elementInfo.defaultFontName,
                writingMode: elementInfo.vertical ? 'vertical-rl' : 'horizontal-tb',
            }" v-contextmenu="contextmenus" @mousedown="$event => handleSelectElement($event)"
                @touchstart="$event => handleSelectElement($event)" @dblclick="openEditor">
                <ElementOutline :width="elementInfo.width" :height="elementInfo.height"
                    :outline="elementInfo.outline" />
                <div 
                    class="text-content" 
                    :style="{
                        '--paragraphSpace': `${elementInfo.paragraphSpace === undefined ? 5 : elementInfo.paragraphSpace}px`,
                    }"
                >
                    <template v-for="(part, index) in parsedContent" :key="index">
                        <span v-if="part.type === 'text'" v-html="part.content"></span>
                        <span v-else-if="part.type === 'latex-inline'" class="latex-inline">
                            <vue-latex :expression="part.content" :fontsize="getFontSize()" />
                        </span>
                        <div v-else-if="part.type === 'latex-block'" class="latex-block">
                            <vue-latex :expression="part.content" :fontsize="getFontSize() + 2" />
                        </div>
                    </template>
                </div>

                <!-- 当字号过大且行高较小时，会出现文字高度溢出的情况，导致拖拽区域无法被选中，因此添加了以下节点避免该情况 -->
                <div class="drag-handler top"></div>
                <div class="drag-handler bottom"></div>
            </div>
        </div>
    </div>

    <Modal
        v-model:visible="editorVisible" 
        :width="920"
    >
        <LatexTextEditor 
            :value="elementInfo.content"
            :defaultColor="elementInfo.defaultColor"
            :defaultFontName="elementInfo.defaultFontName"
            :lineHeight="elementInfo.lineHeight"
            @close="editorVisible = false"
            @update="handleUpdateContent"
        />
    </Modal>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import { debounce } from 'lodash'
import { useMainStore, useSlidesStore } from '@/store'
import type { PPTLatexTextElement } from '@/types/slides'
import type { ContextmenuItem } from '@/components/Contextmenu/types'
import useElementShadow from '@/views/components/element/hooks/useElementShadow'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'
import { parseLatexText } from '@/utils/latexTextRenderer'

import ElementOutline from '@/views/components/element/ElementOutline.vue'
import Modal from '@/components/Modal.vue'
import LatexTextEditor from '@/components/LatexTextEditor/index.vue'

const props = defineProps<{
    elementInfo: PPTLatexTextElement
    selectElement: (e: MouseEvent | TouchEvent, element: PPTLatexTextElement, canMove?: boolean) => void
    contextmenus: () => ContextmenuItem[] | null
}>()

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const { handleElementId, isScaling } = storeToRefs(mainStore)

const { addHistorySnapshot } = useHistorySnapshot()

const elementRef = useTemplateRef<HTMLElement>('elementRef')
const editorVisible = ref(false)

const shadow = computed(() => props.elementInfo.shadow)
const { shadowStyle } = useElementShadow(shadow)

// 解析内容以渲染 LaTeX
const parsedContent = computed(() => {
  if (!props.elementInfo.content) return []
  return parseLatexText(props.elementInfo.content)
})

// 根据元素高度计算字体大小
const getFontSize = () => {
  const baseSize = 16
  if (props.elementInfo.height) {
    const size = Math.max(12, Math.min(24, props.elementInfo.height / 20))
    return Math.round(size)
  }
  return baseSize
}

const handleSelectElement = (e: MouseEvent | TouchEvent, canMove = true) => {
  if (props.elementInfo.lock) return
  e.stopPropagation()

  props.selectElement(e, props.elementInfo, canMove)
}

// 双击打开编辑弹窗
const openEditor = (e: MouseEvent) => {
  if (props.elementInfo.lock) return
  e.stopPropagation()
  editorVisible.value = true
}

// 监听文本元素的尺寸变化，当高度变化时，更新高度到vuex
// 如果高度变化时正处在缩放操作中，则等待缩放操作结束后再更新
const realHeightCache = ref(-1)
const realWidthCache = ref(-1)

watch(isScaling, () => {
  if (handleElementId.value !== props.elementInfo.id) return

  if (!isScaling.value) {
    if (!props.elementInfo.vertical && realHeightCache.value !== -1) {
      slidesStore.updateElement({
        id: props.elementInfo.id,
        props: { height: realHeightCache.value },
      })
      realHeightCache.value = -1
    }
    if (props.elementInfo.vertical && realWidthCache.value !== -1) {
      slidesStore.updateElement({
        id: props.elementInfo.id,
        props: { width: realWidthCache.value },
      })
      realWidthCache.value = -1
    }
  }
})

const updateTextElementHeight = (entries: ResizeObserverEntry[]) => {
  const contentRect = entries[0].contentRect
  if (!elementRef.value) return

  const realHeight = contentRect.height + 20
  const realWidth = contentRect.width + 20

  if (!props.elementInfo.vertical && props.elementInfo.height !== realHeight) {
    if (!isScaling.value) {
      slidesStore.updateElement({
        id: props.elementInfo.id,
        props: { height: realHeight },
      })
    }
    else realHeightCache.value = realHeight
  }
  if (props.elementInfo.vertical && props.elementInfo.width !== realWidth) {
    if (!isScaling.value) {
      slidesStore.updateElement({
        id: props.elementInfo.id,
        props: { width: realWidth },
      })
    }
    else realWidthCache.value = realWidth
  }
}
const resizeObserver = new ResizeObserver(updateTextElementHeight)

onMounted(() => {
  if (elementRef.value) resizeObserver.observe(elementRef.value)
})
onUnmounted(() => {
  if (elementRef.value) resizeObserver.unobserve(elementRef.value)
})

const handleUpdateContent = (content: string) => {
  slidesStore.updateElement({
    id: props.elementInfo.id,
    props: { content },
  })
  addHistorySnapshot()
}

const checkEmptyText = debounce(function() {
  const pureText = props.elementInfo.content.replace(/<[^>]+>/g, '').replace(/\$/g, '')
  if (!pureText.trim()) slidesStore.deleteElement(props.elementInfo.id)
}, 300, { trailing: true })

const isHandleElement = computed(() => handleElementId.value === props.elementInfo.id)
watch(isHandleElement, () => {
  if (!isHandleElement.value) checkEmptyText()
})
</script>

<style lang="scss" scoped>
.editable-element-text {
    position: absolute;

    &.lock .element-content {
        cursor: default;
    }
}

.rotate-wrapper {
    width: 100%;
    height: 100%;
}

.element-content {
    position: relative;
    padding: 10px;
    line-height: 1.5;
    word-break: break-word;
    cursor: move;

    .text-content {
        position: relative;
        cursor: text;
        
        .latex-inline {
            display: inline-block;
            vertical-align: middle;
            margin: 0 2px;
        }
        
        .latex-block {
            display: block;
            text-align: center;
            margin: 10px 0;
        }
    }

    .text {
        position: relative;
    }

    ::v-deep(a) {
        cursor: text;
    }
}

.drag-handler {
    height: 10px;
    position: absolute;
    left: 0;
    right: 0;

    &.top {
        top: 0;
    }

    &.bottom {
        bottom: 0;
    }
}
</style>