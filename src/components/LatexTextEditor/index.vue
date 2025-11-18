<template>
  <div class="latex-text-editor">
    <div class="container">
      <div class="left">
        <div class="editor-wrapper">
          <div class="editor-toolbar">
            <div class="toolbar-item" @click="insertInlineFormula" title="插入行内公式">
              <span class="toolbar-icon">$</span>
              <span>行内公式</span>
            </div>
            <div class="toolbar-item" @click="insertBlockFormula" title="插入块级公式">
              <span class="toolbar-icon">$$</span>
              <span>块级公式</span>
            </div>
          </div>
          <div 
            class="editor-content" 
            ref="editorRef"
            contenteditable="true"
            :style="{
              color: defaultColor,
              fontFamily: defaultFontName,
              lineHeight: lineHeight || 1.5,
            }"
            @input="handleInput"
            @paste="handlePaste"
            @keydown="handleKeydown"
          ></div>
        </div>
        <div class="preview">
          <div class="preview-header">预览</div>
          <div class="preview-content" v-if="htmlContent">
            <div 
              class="preview-text" 
              :style="{
                color: defaultColor,
                fontFamily: defaultFontName,
                lineHeight: lineHeight || 1.5,
              }"
            >
              <template v-for="(part, index) in parsedContent" :key="index">
                <span v-if="part.type === 'text'" v-html="part.content"></span>
                <span v-else-if="part.type === 'latex-inline'" class="latex-inline">
                  <vue-latex :expression="part.content" :fontsize="16" />
                </span>
                <div v-else-if="part.type === 'latex-block'" class="latex-block">
                  <vue-latex :expression="part.content" :fontsize="18" />
                </div>
              </template>
            </div>
          </div>
          <div class="preview-placeholder" v-else>预览将显示在这里</div>
        </div>
      </div>
      <div class="right">
        <Tabs 
          :tabs="tabs" 
          v-model:value="toolbarState" 
          card
        />
        <div class="content">
          <div class="symbol" v-if="toolbarState === 'symbol'">
            <Tabs 
              :tabs="symbolTabs" 
              v-model:value="selectedSymbolKey" 
              spaceBetween 
              :tabsStyle="{ margin: '10px 10px 0' }" 
            />
            <div class="symbol-pool">
              <div class="symbol-item" v-for="item in symbolPool" :key="item.latex" @click="insertSymbol(item.latex)">
                <SymbolContent :latex="item.latex" />
              </div>
            </div>
          </div>
          <div class="formula" v-else>
            <div class="formula-item" v-for="item in formulaList" :key="item.label">
              <div class="formula-title">{{item.label}}</div>
              <div class="formula-item-content" @click="insertFormula(item.latex)">
                <vue-latex :expression="item.latex" :fontsize="8" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="footer">
      <Button class="btn" @click="emit('close')">取消</Button>
      <Button class="btn" type="primary" @click="update()">确定</Button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { FORMULA_LIST, SYMBOL_LIST } from '@/configs/latex'
import { parseLatexText, latexTextToHtml, htmlToLatexText } from '@/utils/latexTextRenderer'
import TextArea from '../TextArea.vue'
import Button from '../Button.vue'
import Tabs from '../Tabs.vue'
import SymbolContent from '../LaTeXEditor/SymbolContent.vue'

interface TabItem {
  key: 'symbol' | 'formula'
  label: string
}

const tabs: TabItem[] = [
  { label: '常用符号', key: 'symbol' },
  { label: '预置公式', key: 'formula' },
]

const props = withDefaults(defineProps<{
  value?: string
  defaultColor?: string
  defaultFontName?: string
  lineHeight?: number
}>(), {
  value: '',
  defaultColor: '#000',
  defaultFontName: 'Microsoft YaHei',
  lineHeight: 1.5,
})

const emit = defineEmits<{
  (event: 'update', payload: string): void
  (event: 'close'): void
}>()

const formulaList = FORMULA_LIST

const symbolTabs = SYMBOL_LIST.map(item => ({
  label: item.label,
  key: item.type,
}))

const editorRef = useTemplateRef<HTMLDivElement>('editorRef')
const toolbarState = ref<'symbol' | 'formula'>('symbol')
const htmlContent = ref('')

const selectedSymbolKey = ref(SYMBOL_LIST[0].type)
const symbolPool = computed(() => {
  const selectedSymbol = SYMBOL_LIST.find(item => item.type === selectedSymbolKey.value)
  return selectedSymbol?.children || []
})

// 解析内容用于预览
const parsedContent = computed(() => {
  if (!htmlContent.value) return []
  return parseLatexText(htmlContent.value)
})

// 初始化编辑器内容
onMounted(() => {
  if (props.value) {
    // 将 HTML 转换为可编辑的格式
    const text = htmlToLatexText(props.value)
    if (editorRef.value) {
      editorRef.value.textContent = text
      htmlContent.value = props.value
    }
  } else {
    htmlContent.value = ''
  }
  
  setTimeout(() => {
    if (editorRef.value) {
      editorRef.value.focus()
    }
  }, 0)
})

// 处理输入
const handleInput = (e: Event) => {
  const target = e.target as HTMLDivElement
  const text = target.textContent || ''
  
  // 将纯文本转换为 HTML（包含 LaTeX 标记）
  htmlContent.value = latexTextToHtml(text)
}

// 处理粘贴，清理格式
const handlePaste = (e: ClipboardEvent) => {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') || ''
  
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return
  
  const range = selection.getRangeAt(0)
  range.deleteContents()
  
  const textNode = document.createTextNode(text)
  range.insertNode(textNode)
  
  // 移动光标到插入位置之后
  range.setStartAfter(textNode)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  
  // 触发输入事件
  handleInput(e)
}

// 处理键盘事件
const handleKeydown = (e: KeyboardEvent) => {
  // Enter 键处理
  if (e.key === 'Enter') {
    e.preventDefault()
    insertTextAtCursor('\n')
  }
}

// 在光标位置插入文本
const insertTextAtCursor = (text: string) => {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return
  
  const range = selection.getRangeAt(0)
  range.deleteContents()
  
  const textNode = document.createTextNode(text)
  range.insertNode(textNode)
  
  // 移动光标到插入位置之后
  range.setStartAfter(textNode)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  
  // 触发输入事件
  if (editorRef.value) {
    const event = new Event('input', { bubbles: true })
    editorRef.value.dispatchEvent(event)
  }
}

// 获取光标位置的文本
const getTextAtCursor = () => {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return ''
  
  const range = selection.getRangeAt(0)
  const text = range.toString()
  return text
}

// 插入行内公式
const insertInlineFormula = () => {
  const selectedText = getTextAtCursor()
  const formula = selectedText || 'x'
  insertTextAtCursor(`$${formula}$`)
}

// 插入块级公式
const insertBlockFormula = () => {
  const selectedText = getTextAtCursor()
  const formula = selectedText || 'x'
  insertTextAtCursor(`\n$$${formula}$$\n`)
}

// 插入符号
const insertSymbol = (latex: string) => {
  insertTextAtCursor(`$${latex}$`)
}

// 插入公式
const insertFormula = (latex: string) => {
  insertTextAtCursor(`$$${latex}$$`)
}

const update = () => {
  if (!htmlContent.value.trim()) {
    emit('update', '')
    emit('close')
    return
  }
  
  emit('update', htmlContent.value)
  emit('close')
}
</script>

<style lang="scss" scoped>
.latex-text-editor {
  height: 650px;
}

.container {
  height: calc(100% - 50px);
  display: flex;
}

.left {
  width: 650px;
  height: 100%;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid $borderColor;
  border-radius: 4px;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  padding: 8px;
  background-color: #f5f5f5;
  border-bottom: 1px solid $borderColor;
  gap: 8px;
}

.toolbar-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: #fff;
  border: 1px solid $borderColor;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  user-select: none;
  
  &:hover {
    background-color: #e6f7ff;
    border-color: $themeColor;
  }
  
  .toolbar-icon {
    font-weight: bold;
    color: $themeColor;
  }
}

.editor-content {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  outline: none;
  word-break: break-word;
  white-space: pre-wrap;
  min-height: 200px;
  
  &:focus {
    background-color: #fafafa;
  }
  
  &::before {
    content: attr(placeholder);
    color: #999;
    pointer-events: none;
    position: absolute;
  }
  
  &:empty::before {
    content: '在此输入文本和公式，使用 $公式$ 表示行内公式，$$公式$$ 表示块级公式';
  }
}

.preview {
  height: 200px;
  margin-top: 20px;
  border: 1px solid $borderColor;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  padding: 8px 12px;
  background-color: #f5f5f5;
  border-bottom: 1px solid $borderColor;
  font-size: 12px;
  font-weight: bold;
  color: #666;
}

.preview-content {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}

.preview-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 13px;
}

.preview-text {
  word-break: break-word;
  
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

.right {
  width: 280px;
  height: 100%;
  margin-left: 20px;
  border: solid 1px $borderColor;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  user-select: none;
}

.content {
  height: calc(100% - 40px);
  font-size: 13px;
}

.formula {
  height: 100%;
  padding: 12px;

  @include overflow-overlay();
}

.formula-item {
  & + .formula-item {
    margin-top: 10px;
  }

  .formula-title {
    margin-bottom: 5px;
  }
  
  .formula-item-content {
    height: 60px;
    padding: 5px;
    display: flex;
    align-items: center;
    background-color: $lightGray;
    cursor: pointer;
  }
}

.symbol {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.symbol-pool {
  display: flex;
  flex-wrap: wrap;
  flex: 1;
  padding: 12px;

  @include overflow-overlay();
}

.symbol-item {
  display: flex;
  justify-content: center;
  align-items: center;

  &:hover {
    background-color: $lightGray;
    cursor: pointer;
  }
}

.footer {
  height: 50px;
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;

  .btn {
    margin-left: 10px;
  }
}
</style>
