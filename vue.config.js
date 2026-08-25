module.exports = {
  chainWebpack: config => {
    config.plugin('define').tap(args => {
      args[0]['process.env'].USE_FANCY_INDEX = JSON.stringify('true')
      return args
    })
  }
}
