import { comparePuesto } from './puesto'

it('ordena por número asignado como en el Excel', () => {
  const list = ['10.1', '2', 's3', '', '10', 'S11', '1', '103.1', 's1']
  expect([...list].sort(comparePuesto)).toEqual(['1', '2', '10', '10.1', '103.1', 's1', 's3', 'S11', ''])
})
