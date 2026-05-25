/** 程序化变换（一键对齐等）进行中时，禁用 Shift 吸附避免互相干扰 */
let aligning = false;

export function setAligning(value: boolean) {
  aligning = value;
}

export function isAligning() {
  return aligning;
}
