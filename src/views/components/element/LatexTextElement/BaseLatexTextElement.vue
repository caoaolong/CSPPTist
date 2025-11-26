<template>
    <div class="base-element-text" :style="{
        top: elementInfo.top + 'px',
        left: elementInfo.left + 'px',
        width: elementInfo.width + 'px',
        height: elementInfo.height + 'px',
    }">
        <div class="rotate-wrapper" :style="{ transform: `rotate(${elementInfo.rotate}deg)` }">
            <div class="element-content" :style="{
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
            }">
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
                        <span v-else-if="part.type === 'markdown'" v-html="renderMarkdown(part.content)"></span>
                        <span v-else-if="part.type === 'latex-inline'" class="latex-inline">
                            <vue-latex :expression="part.content" :fontsize="getFontSize()" />
                        </span>
                        <div v-else-if="part.type === 'latex-block'" class="latex-block">
                            <vue-latex :expression="part.content" :fontsize="getFontSize() + 2" />
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { PPTLatexTextElement } from '@/types/slides'
import ElementOutline from '@/views/components/element/ElementOutline.vue'
import { parseLatexText } from '@/utils/latexTextRenderer'
import { renderMarkdown } from '@/utils/markdownRenderer'

import useElementShadow from '@/views/components/element/hooks/useElementShadow'

const props = defineProps<{
    elementInfo: PPTLatexTextElement
    target?: string
}>()

const shadow = computed(() => props.elementInfo.shadow)
const { shadowStyle } = useElementShadow(shadow)

// 解析内容以渲染 LaTeX
const parsedContent = computed(() => {
  if (!props.elementInfo.content) return []
  return parseLatexText(props.elementInfo.content)
})

// 根据元素高度计算字体大小
const getFontSize = () => {
  // 基础字体大小，可以根据元素高度调整
  const baseSize = 16
  if (props.elementInfo.height) {
    // 根据高度动态调整，但保持在合理范围内
    const size = Math.max(12, Math.min(24, props.elementInfo.height / 20))
    return Math.round(size)
  }
  return baseSize
}
</script>

<style lang="scss" scoped>
.base-element-text {
    position: absolute;
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

    .text-content {
        position: relative;
        
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
        
        // Markdown 样式
        ::v-deep(h1), ::v-deep(h2), ::v-deep(h3), ::v-deep(h4), ::v-deep(h5), ::v-deep(h6) {
            margin: 0.5em 0;
            font-weight: bold;
        }
        
        ::v-deep(p) {
            margin: 0.5em 0;
        }
        
        ::v-deep(ul), ::v-deep(ol) {
            margin: 0.5em 0;
            padding-left: 1.5em;
        }
        
        ::v-deep(li) {
            margin: 0.25em 0;
        }
        
        ::v-deep(strong) {
            font-weight: bold;
        }
        
        ::v-deep(em) {
            font-style: italic;
        }
        
        ::v-deep(code) {
            background-color: rgba(0, 0, 0, 0.1);
            padding: 0.1em 0.3em;
            border-radius: 3px;
            font-family: monospace;
        }
        
        ::v-deep(blockquote) {
            border-left: 3px solid rgba(0, 0, 0, 0.2);
            padding-left: 1em;
            margin: 0.5em 0;
        }
        
        // Markdown 表格样式
        ::v-deep(table) {
            border-collapse: collapse;
            border-spacing: 0;
            width: 100%;
            margin: 0.5em 0;
            display: table;
            
            th, td {
                border: 1px solid rgba(0, 0, 0, 0.2);
                padding: 0.5em;
                text-align: left;
            }
            
            th {
                background-color: rgba(0, 0, 0, 0.05);
                font-weight: bold;
            }
            
            tr:nth-child(even) {
                background-color: rgba(0, 0, 0, 0.02);
            }
        }
    }

    .text {
        position: relative;

        &.thumbnail {
            pointer-events: none;
        }
    }
}
</style>