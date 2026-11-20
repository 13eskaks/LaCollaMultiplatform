export function withBridge(html: string) {
  const bridge = `<script>function send(d){try{if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(d)}else{window.parent.postMessage({__lacolla:true,data:d},'*')}}catch(e){}}</script>`
  return html.includes('<head>') ? html.replace('<head>', '<head>' + bridge) : bridge + html
}
