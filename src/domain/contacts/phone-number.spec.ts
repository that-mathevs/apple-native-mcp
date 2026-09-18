import { describe, expect, it } from "vitest";

import { e164, sameNumber } from "./phone-number.js";

describe("a phone number", () => {
  it("given a number that states its country, normalises it to E.164 whatever spaces, dashes, dots or brackets it is written with", () => {
    expect(e164("+1 (555) 123-4567")).toBe("+15551234567");
    expect(e164("+44 20.7946.0958")).toBe("+442079460958");
  });

  // #17: what is dialled to leave a country depends on the country (00, 011, 010, 0011), so
  // reading 00 as "+" would make the answer depend on where the number was written.
  it("given the prefix 00 in place of a plus, has no E.164 form: only a plus states a country", () => {
    expect(e164("0044 20 7946 0958")).toBeUndefined();
  });

  it("given a country code written in brackets, reads it as stating its country", () => {
    expect(e164("(+44) 20 7946 0958")).toBe("+442079460958");
  });

  it("given an extension after the number, leaves it out of the E.164 form", () => {
    expect(e164("+1 555 123 4567 x89")).toBe("+15551234567");
    expect(e164("+1 555 123 4567;ext=89")).toBe("+15551234567");
  });

  // Numbers pasted from Contacts and from Messages arrive wrapped in invisible direction marks.
  it("given a number wrapped in invisible direction marks, reads the number inside them", () => {
    expect(e164("\u202A+44 7700 900123\u202C")).toBe("+447700900123");
  });

  // A zero straight after the country code is a trunk prefix in Britain and part of the number
  // in Italy. Guessing which would make up a number nobody wrote.
  it("given a zero straight after the country code, has no E.164 form unless the country keeps its zeros", () => {
    expect(e164("+44 020 7946 0958")).toBeUndefined();
    expect(e164("+39 06 1234 5678")).toBe("+390612345678");
  });

  it("given a plus anywhere but once at the start, or a country code beginning with zero, has no E.164 form", () => {
    expect(e164("++44 20 7946 0958")).toBeUndefined();
    expect(e164("+44+20 7946 0958")).toBeUndefined();
    expect(e164("+0 20 7946 0958")).toBeUndefined();
  });

  // upstream #35
  it("given a country code and a national trunk prefix in brackets, normalises it to one E.164 number", () => {
    expect(e164("+44 (0)20 7946 0958")).toBe("+442079460958");
  });

  // #17: the answer must never depend on the Mac's region. faces-sh read a bare number in
  // the machine's region and sent to the wrong country.
  it("given a number that does not state its country, has no E.164 form: a bare national number is never given a country", () => {
    expect(e164("020 7946 0958")).toBeUndefined();
    expect(e164("(555) 123-4567")).toBeUndefined();
  });

  it("given something that is not a phone number, has no E.164 form", () => {
    expect(e164("+44 CALL ME")).toBeUndefined();
    expect(e164("+")).toBeUndefined();
  });
});

describe("two phone numbers", () => {
  // ANierbeck 813c232
  it("given the same number written with spaces, dashes or brackets, are the same number", () => {
    expect(sameNumber("+1 555 123 4567", "+1 (555) 123-4567")).toBe(true);
    expect(sameNumber("555-123-4567", "(555) 123 4567")).toBe(true);
  });

  // upstream #35: a loose contains() sent a message to the wrong person.
  it("given one that merely contains the other, are different numbers", () => {
    expect(sameNumber("+15551234567", "5551234")).toBe(false);
    expect(sameNumber("1234567", "234567")).toBe(false);
  });

  // KassebaumEngineering 13fd400 matched on the last ten digits.
  it("given two that share their trailing digits but state different countries, are different numbers", () => {
    expect(sameNumber("+1 555 123 4567", "+44 555 123 4567")).toBe(false);
  });

  it("given a bare national number and one that states its country, are the same when the national parts are, with or without a trunk zero", () => {
    expect(sameNumber("020 7946 0958", "+44 20 7946 0958")).toBe(true);
    expect(sameNumber("555 123 4567", "+1 555 123 4567")).toBe(true);
    expect(sameNumber("555 123 4567", "+1 555 123 4568")).toBe(false);
  });

  it("given a bare national number in a country that keeps its leading zero, is the same as the number that states that country", () => {
    expect(sameNumber("06 1234 5678", "+39 06 1234 5678")).toBe(true);
  });

  it("given a number written with its country code and no plus, is the same as the one with the plus", () => {
    expect(sameNumber("1 555 123 4567", "+1 555 123 4567")).toBe(true);
    expect(sameNumber("44 20 7946 0958", "+44 20 7946 0958")).toBe(true);
  });
});
