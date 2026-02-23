FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --production

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["bun", "run", "start"]
```


```
