"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 rounded-lg bg-slate-800 px-4 py-3 font-mono text-sm text-cyan-300">
      {children}
    </div>
  );
}

export default function ResearchContent() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Introduction */}
      <Card>
        <CardHeader>
          <CardTitle>Introduction to Fatigue Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-slate-300 leading-relaxed">
          <p>
            Fatigue failure is one of the most common and dangerous modes of
            mechanical failure in engineering components. It occurs when a
            material is subjected to repeated cyclic loading, even at stress
            levels well below the static yield strength. Approximately 80-90% of
            all structural failures are attributed to fatigue.
          </p>
          <p>
            Fatigue analysis enables engineers to predict the service life of
            components and ensure structural integrity under cyclic loading
            conditions. The two primary approaches are the Stress-Life (S-N)
            method for high-cycle fatigue and the Strain-Life method for
            low-cycle fatigue.
          </p>
        </CardContent>
      </Card>

      {/* Stress-Life Approach */}
      <Card>
        <CardHeader>
          <CardTitle>Stress-Life (S-N) Approach</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-slate-300 leading-relaxed">
          <p>
            The Stress-Life approach, also known as the S-N method, is the
            oldest and most widely used fatigue analysis technique. It relates
            the applied stress amplitude to the number of cycles to failure
            using empirical data plotted on S-N curves (Wohler curves).
          </p>
          <h4 className="text-lg font-semibold text-white">
            Basquin&apos;s Equation
          </h4>
          <p>
            The high-cycle fatigue region of the S-N curve is described by
            Basquin&apos;s equation, which provides a linear relationship on a
            log-log scale:
          </p>
          <Formula>
            S_a = sigma_f&apos; * (2N_f)^b
          </Formula>
          <p>Where:</p>
          <ul className="ml-4 list-disc space-y-1 text-sm">
            <li>
              <span className="font-mono text-cyan-300">S_a</span> = stress
              amplitude (MPa)
            </li>
            <li>
              <span className="font-mono text-cyan-300">sigma_f&apos;</span> =
              fatigue strength coefficient (MPa)
            </li>
            <li>
              <span className="font-mono text-cyan-300">2N_f</span> = reversals
              to failure
            </li>
            <li>
              <span className="font-mono text-cyan-300">b</span> = fatigue
              strength exponent (Basquin&apos;s exponent)
            </li>
          </ul>
          <p>
            This approach is best suited for high-cycle fatigue (N &gt; 10^3
            cycles) where stresses remain primarily elastic.
          </p>
        </CardContent>
      </Card>

      {/* Strain-Life Approach */}
      <Card>
        <CardHeader>
          <CardTitle>Strain-Life Approach</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-slate-300 leading-relaxed">
          <p>
            The Strain-Life approach is used for low-cycle fatigue analysis
            where significant plastic deformation occurs. It uses total strain
            amplitude as the damage parameter.
          </p>
          <h4 className="text-lg font-semibold text-white">
            Coffin-Manson Equation
          </h4>
          <p>
            The total strain amplitude combines elastic and plastic components:
          </p>
          <Formula>
            epsilon_a = (sigma_f&apos; / E) * (2N_f)^b + epsilon_f&apos; * (2N_f)^c
          </Formula>
          <p>Where:</p>
          <ul className="ml-4 list-disc space-y-1 text-sm">
            <li>
              <span className="font-mono text-cyan-300">epsilon_a</span> = total
              strain amplitude
            </li>
            <li>
              <span className="font-mono text-cyan-300">E</span> = elastic
              modulus (MPa)
            </li>
            <li>
              <span className="font-mono text-cyan-300">epsilon_f&apos;</span> =
              fatigue ductility coefficient
            </li>
            <li>
              <span className="font-mono text-cyan-300">c</span> = fatigue
              ductility exponent
            </li>
          </ul>
          <p>
            The first term represents the elastic strain (Basquin) and the
            second term represents the plastic strain (Coffin-Manson). The
            transition life occurs where the elastic and plastic strain
            amplitudes are equal.
          </p>
        </CardContent>
      </Card>

      {/* Mean Stress Corrections */}
      <Card>
        <CardHeader>
          <CardTitle>Mean Stress Correction Models</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-slate-300 leading-relaxed">
          <p>
            In practice, cyclic loading rarely oscillates symmetrically about
            zero stress. Mean stress corrections account for the effect of
            non-zero mean stress on fatigue life.
          </p>

          {/* Goodman */}
          <div>
            <h4 className="text-lg font-semibold text-blue-400">
              Goodman Model
            </h4>
            <p className="mt-1">
              The modified Goodman criterion provides a linear relationship
              between stress amplitude and mean stress. It is the most widely
              used and generally conservative for ductile materials under
              tensile mean stress.
            </p>
            <Formula>S_a / S_e + S_m / S_ut = 1</Formula>
            <p className="text-sm text-slate-400">
              Best for: General purpose, conservative estimate, ductile metals
            </p>
          </div>

          {/* Gerber */}
          <div>
            <h4 className="text-lg font-semibold text-green-400">
              Gerber Model
            </h4>
            <p className="mt-1">
              The Gerber criterion uses a parabolic relationship. It fits
              experimental data for ductile metals more closely than Goodman,
              but is less conservative.
            </p>
            <Formula>S_a / S_e + (S_m / S_ut)^2 = 1</Formula>
            <p className="text-sm text-slate-400">
              Best for: Ductile materials when a less conservative estimate is
              acceptable
            </p>
          </div>

          {/* Soderberg */}
          <div>
            <h4 className="text-lg font-semibold text-orange-400">
              Soderberg Model
            </h4>
            <p className="mt-1">
              The Soderberg criterion is similar to Goodman but uses yield
              strength instead of ultimate tensile strength. This makes it the
              most conservative of the classical criteria.
            </p>
            <Formula>S_a / S_e + S_m / S_y = 1</Formula>
            <p className="text-sm text-slate-400">
              Best for: Most conservative approach, prevents yielding
            </p>
          </div>

          {/* Morrow */}
          <div>
            <h4 className="text-lg font-semibold text-purple-400">
              Morrow Model
            </h4>
            <p className="mt-1">
              The Morrow criterion replaces the ultimate tensile strength with
              the true fracture strength (or fatigue strength coefficient). It
              is particularly effective for steels and gives better correlation
              with experimental data.
            </p>
            <Formula>S_a / S_e + S_m / sigma_f&apos; = 1</Formula>
            <p className="text-sm text-slate-400">
              Best for: Steels, better correlation with test data
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Marin Factors */}
      <Card>
        <CardHeader>
          <CardTitle>Marin Modification Factors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-slate-300 leading-relaxed">
          <p>
            The endurance limit obtained from standard laboratory specimens must
            be modified to account for real-world conditions. The Marin equation
            adjusts the endurance limit using multiplicative factors:
          </p>
          <Formula>
            S_e = k_a * k_b * k_c * k_d * k_e * S_e&apos;
          </Formula>
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-800/50 p-3">
              <h5 className="font-semibold text-white">
                k_a -- Surface Condition Factor
              </h5>
              <p className="mt-1 text-sm">
                Accounts for the effect of surface finish on fatigue strength.
                Rougher surfaces introduce stress concentrations that reduce
                fatigue life. Typical values: Ground (0.89), Machined (0.72),
                Hot-Rolled (0.51), Forged (0.37) for steels at 400 MPa UTS.
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3">
              <h5 className="font-semibold text-white">
                k_b -- Size Factor
              </h5>
              <p className="mt-1 text-sm">
                Larger components have a higher probability of containing
                critical flaws. For round bars in bending/torsion with diameter
                d: k_b = 1.0 for d &le; 8mm, k_b = 1.189*d^(-0.097) for
                8 &lt; d &le; 250mm.
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3">
              <h5 className="font-semibold text-white">
                k_c -- Load Factor
              </h5>
              <p className="mt-1 text-sm">
                Accounts for the type of loading. Bending: k_c = 1.0, Axial:
                k_c = 0.85, Torsion: k_c = 0.59. The endurance limit is
                typically determined under rotating bending; other load types
                require correction.
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3">
              <h5 className="font-semibold text-white">
                k_d -- Temperature Factor
              </h5>
              <p className="mt-1 text-sm">
                Elevated temperatures reduce material strength and fatigue
                resistance. k_d = 1.0 for T &le; 450C for steels. At higher
                temperatures, fatigue properties degrade and creep interactions
                become significant.
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3">
              <h5 className="font-semibold text-white">
                k_e -- Reliability Factor
              </h5>
              <p className="mt-1 text-sm">
                Standard S-N data represents 50% reliability (mean life).
                Higher reliability requirements reduce the design endurance
                limit. Typical values: 90% (0.897), 95% (0.868), 99% (0.814),
                99.9% (0.753).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* References */}
      <Card>
        <CardHeader>
          <CardTitle>References</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="ml-4 list-decimal space-y-2 text-sm text-slate-400">
            <li>
              Shigley, J.E., Mischke, C.R., and Budynas, R.G.,{" "}
              <span className="italic text-slate-300">
                Mechanical Engineering Design
              </span>
              , McGraw-Hill.
            </li>
            <li>
              Dowling, N.E.,{" "}
              <span className="italic text-slate-300">
                Mechanical Behavior of Materials
              </span>
              , Pearson.
            </li>
            <li>
              Bannantine, J.A., Comer, J.J., and Handrock, J.L.,{" "}
              <span className="italic text-slate-300">
                Fundamentals of Metal Fatigue Analysis
              </span>
              , Prentice Hall.
            </li>
            <li>
              Lee, Y.-L., Pan, J., Hathaway, R., and Barkey, M.,{" "}
              <span className="italic text-slate-300">
                Fatigue Testing and Analysis
              </span>
              , Butterworth-Heinemann.
            </li>
            <li>
              ASM International,{" "}
              <span className="italic text-slate-300">
                ASM Handbook, Volume 19: Fatigue and Fracture
              </span>
              .
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
