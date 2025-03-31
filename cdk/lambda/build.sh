#!/bin/bash

# Clean up previous build
rm -rf dist
mkdir -p dist

# Install root dependencies
npm install

# Build each Lambda function
for dir in connect disconnect default sendMessage fileUpload; do
  echo "Building $dir Lambda..."
  
  # Create dist directory for the Lambda
  mkdir -p dist/$dir
  
  # If package.json exists in the Lambda directory, use it
  if [ -f "$dir/package.json" ]; then
    echo "Using Lambda-specific package.json for $dir"
    cp $dir/package.json dist/$dir/
    (cd dist/$dir && npm install)
  else
    echo "Using default package.json for $dir"
    cp package.json dist/$dir/
    (cd dist/$dir && npm install)
  fi
  
  # Copy TypeScript files and compile
  echo "Compiling TypeScript for $dir..."
  cp $dir/index.ts dist/$dir/
  cp tsconfig.json dist/$dir/
  (cd dist/$dir && npx tsc index.ts --outDir .)
done

echo "Build complete!" 