# Sources

Every number in `results.json` is copied from the Pulse repository,
[github.com/MatiiiBL/riscv-npu-soc](https://github.com/MatiiiBL/riscv-npu-soc), at commit
`5bc8ccf604e92bab164cab90bbf0d6a9dfc36106`. The repository measures them on the RTL with Verilator
(cycle-exact) and on the ECP5 FPGA flow; nothing here is recomputed or rounded further.

| Key             | File                        | Where                                                |
| --------------- | --------------------------- | ---------------------------------------------------- |
| `speedups`      | `README.md`                 | Results, "NPU vs. CPU"                               |
| `tileSteps`     | `README.md`                 | Results, the 8 × 8 × 1024 tile table                 |
| `cycleTable`    | `docs/npu.md`               | Section 6, "Measured (ARR = 8, KMAX = 1024, INT32)"  |
| `timingClosure` | `README.md`                 | Results, the Fmax table (seeds 1-4; step 0, 8 seeds) |
| `coremark`      | `README.md`                 | Results, "CPU"                                       |
| `fpga`          | `README.md`, `docs/fpga.md` | "FPGA: Radiona ULX3S"; section 6, utilization        |

The systolic-array stepper on the page does not read measured data: it runs `../systolic.ts`, a
cycle-level model written from `rtl/npu/npu_opbuf.sv`, `npu_array.sv`, `npu_pe.sv` and
`npu_top.sv` at the same commit. `../systolic.test.ts` checks it against a plain matrix product
and checks its cycle formula against every `cycleTable` row.
