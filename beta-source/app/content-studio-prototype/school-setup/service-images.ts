export const serviceImages = [
  { id: 'piano', title: 'Piano keys', photo: '7091301', keywords: ['piano', 'keyboard', 'keys'] },
  { id: 'piano-sheet', title: 'Piano and sheet music', photo: '34434114', keywords: ['piano', 'keyboard', 'theory', 'music'] },
  { id: 'guitar', title: 'Acoustic guitar', photo: '13016431', keywords: ['guitar', 'acoustic', 'ukulele'] },
  { id: 'guitar-detail', title: 'Guitar and sheet music', photo: '7520823', keywords: ['guitar', 'acoustic', 'bass'] },
  { id: 'voice', title: 'Studio microphone', photo: '10933688', keywords: ['voice', 'vocal', 'singing', 'choir', 'song'] },
  { id: 'drums', title: 'Drum kit', photo: '7858637', keywords: ['drum', 'percussion', 'band'] },
  { id: 'violin', title: 'Violin strings', photo: '14763384', keywords: ['violin', 'viola', 'cello', 'strings', 'orchestra'] },
].map(image => ({ ...image, src: `/images/services/${image.id}.jpg`, source: `https://www.pexels.com/photo/${image.photo}/` }))

export function suggestedServiceImages(name: string) {
  const words = name.toLowerCase().split(/[^a-z]+/).filter(Boolean)
  return serviceImages.filter(image => image.keywords.some(keyword => words.some(word => word === keyword || word === `${keyword}s`)))
}