const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = (env) => {
  const port = env.PORT || 8081;

  return {
    mode: "development",
    devtool: "eval-cheap-module-source-map",
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].[contenthash].js',
      publicPath: '/'
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        process: "process/browser"
      },
      fallback: {
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        buffer: require.resolve("buffer/"),
        assert: require.resolve("assert"),
        vm: false
      }
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-typescript']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.html$/,
          use: 'html-loader'
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif|ico)$/i,
          type: 'asset/resource'
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        favicon: path.resolve(__dirname, 'public/favicon.ico')
      }),
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser'
      })
    ],
    devServer: {
      static: {
        directory: path.join(__dirname, 'public'),
        publicPath: '/',
        serveIndex: true,
        watch: true,
      },
      port: port,
      hot: true,
      historyApiFallback: true,
      setupMiddlewares: (middlewares, devServer) => {
        if (!devServer) {
          throw new Error('webpack-dev-server is not defined');
        }
        
        // Serve the HTML template from src/main
        devServer.app.get('/src/main/index.html', (req, res) => {
          console.log('Serving src/main/index.html');
          res.sendFile(path.resolve(__dirname, 'src/main/index.html'));
        });
        
        return middlewares;
      }
    }
  };
};