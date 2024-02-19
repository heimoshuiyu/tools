const id = Deno.args[0]
if (!id) {
    console.log('id is not defined!, exit')
    Deno.exit(1)
}

const filepath = 'C:\\Windows\\ServiceProfiles\\LocalService\\AppData\\Roaming\\RustDesk\\config\\Rustdesk.toml'

console.log('Opening', filepath)
const fileContent = await Deno.readTextFile(filepath)

const lines = fileContent.split('\n')
for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('enc_id')) {
        continue
    }
    console.log('Found', lines[i])
    const idLine = `id = '${id}'`
    console.log('Change to', idLine)
    lines[i] = idLine
    console.log('Write back file')
    await Deno.writeTextFile(filepath, lines.join('\n'))
}
