import * as fs from 'node:fs'
import * as path from 'node:path'
import * as yaml from 'js-yaml'
import type { CassetteFile, CassetteInteraction } from '../types.js'
import { CassetteWriteError } from '../errors.js'

export class CassetteStore {
  private filePath: string
  private data: CassetteFile | null = null

  constructor(filePath: string) {
    this.filePath = filePath
  }

  get path(): string {
    return this.filePath
  }

  load(): CassetteFile {
    if (this.data !== null) return this.data
    if (!fs.existsSync(this.filePath)) {
      this.data = { version: 1, interactions: [] }
    } else {
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      this.data = yaml.load(raw) as CassetteFile
      if (!this.data || !Array.isArray(this.data.interactions)) {
        this.data = { version: 1, interactions: [] }
      }
    }
    return this.data
  }

  findById(id: string): CassetteInteraction | undefined {
    return this.load().interactions.find((i) => i.id === id)
  }

  append(interaction: CassetteInteraction): void {
    const data = this.load()
    const existingIndex = data.interactions.findIndex((i) => i.id === interaction.id)
    if (existingIndex >= 0) {
      data.interactions[existingIndex] = interaction
    } else {
      data.interactions.push(interaction)
    }
    this.flush()
  }

  private flush(): void {
    const dir = path.dirname(this.filePath)
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.filePath, yaml.dump(this.data, { sortKeys: true, lineWidth: 120 }))
    } catch (err) {
      throw new CassetteWriteError(this.filePath, err)
    }
  }
}
